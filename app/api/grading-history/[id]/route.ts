import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  canDeleteGradingRecord,
  gradingAssetFilename,
  isExclusiveAssetReference,
} from "@/lib/grading-deletion";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const { id } = await params;
  console.info(`[grading-history][delete][${requestId}] delete requested`, { databaseId: id });
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "未登录", requestId }, { status: 401 });
    if (session.role !== "student") return Response.json({ error: "无权删除该批改记录", requestId }, { status: 403 });

    const record = await prisma.submission.findUnique({ where: { id }, select: { id: true, userId: true, problemImageUrl: true, answerImageUrl: true } });
    if (!record) return Response.json({ error: "批改记录不存在", requestId }, { status: 404 });
    if (!canDeleteGradingRecord(session.id, record.userId)) return Response.json({ error: "无权删除该批改记录", requestId }, { status: 403 });
    console.info(`[grading-history][delete][${requestId}] ownership verified`, { databaseId: id });

    const storedUrls = [...new Set([record.problemImageUrl, record.answerImageUrl].filter((value): value is string => Boolean(value)))];
    const exclusiveUrls = await prisma.$transaction(async (transaction) => {
      const exclusive: string[] = [];
      for (const storedUrl of storedUrls) {
        const referenceCount = await transaction.submission.count({ where: { OR: [{ problemImageUrl: storedUrl }, { answerImageUrl: storedUrl }] } });
        if (isExclusiveAssetReference(referenceCount)) exclusive.push(storedUrl);
      }
      await transaction.submission.delete({ where: { id } });
      return exclusive;
    });
    console.info(`[grading-history][delete][${requestId}] related records deleted`, { databaseId: id, submissionDeleted: true, exclusiveImageCount: exclusiveUrls.length });

    const imageCleanupResults = await Promise.all(exclusiveUrls.map(deleteStoredAsset));
    const failedImageCount = imageCleanupResults.filter((deleted) => !deleted).length;
    if (failedImageCount) {
      console.warn(`[grading-history][delete][${requestId}] image cleanup incomplete`, {
        databaseId: id,
        failedImageCount,
      });
    }
    console.info(`[grading-history][delete][${requestId}] delete completed`, { databaseId: id, status: 200 });
    return Response.json({ success: true, id, requestId });
  } catch (error) {
    console.error(`[grading-history][delete][${requestId}] delete failed`, { databaseId: id, errorType: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "删除批改记录失败", requestId }, { status: 500 });
  }
}

async function deleteStoredAsset(storedUrl: string): Promise<boolean> {
  const filename = gradingAssetFilename(storedUrl);
  if (!filename) return true;
  try {
    await unlink(path.join(process.cwd(), "storage", "grading", filename));
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return true;
    return false;
  }
}
