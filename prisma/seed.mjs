import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const courseNames = [
  "理论力学", "材料力学", "空气动力学", "流体力学", "结构力学",
  "飞行力学", "工程热力学", "传热学", "机械振动", "弹性力学",
  "有限元基础", "航空发动机原理", "飞行器结构设计", "自动控制原理", "航天器动力学",
  "计算流体力学", "复合材料力学", "实验力学", "工程数学", "数值分析",
];
const knowledgePoints = ["力矩平衡", "受力分析", "梁的弯曲", "应力应变", "刚体运动", "动量定理", "边界层", "升阻力"];
const errorTypes = ["公式错误", "计算错误", "方向判断错误", "约束条件遗漏", "单位换算错误"];

async function main() {
  const studentPassword = await hash("student123", 12);
  const teacherPassword = await hash("teacher123", 12);
  const adminPassword = await hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@demo.edu.cn" },
    update: { name: "平台管理员", password: adminPassword, role: UserRole.ADMIN },
    create: { id: "admin-demo", name: "平台管理员", email: "admin@demo.edu.cn", password: adminPassword, role: UserRole.ADMIN },
  });

  const students = [];
  for (let index = 1; index <= 100; index += 1) {
    const padded = String(index).padStart(3, "0");
    const id = index === 1 ? "student-demo" : `seed-student-${padded}`;
    const email = index === 1 ? "student@demo.edu.cn" : `student${padded}@demo.edu.cn`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: `测试学生${padded}`, password: studentPassword, role: UserRole.STUDENT },
      create: { id, name: `测试学生${padded}`, email, password: studentPassword, role: UserRole.STUDENT },
    });
    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { studentId: `2026${padded}`, major: "飞行器设计与工程", className: `航设${Math.ceil(index / 25)}班` },
      create: { userId: user.id, studentId: `2026${padded}`, major: "飞行器设计与工程", className: `航设${Math.ceil(index / 25)}班` },
    });
    students.push(user);
  }

  for (let index = 1; index <= 10; index += 1) {
    const padded = String(index).padStart(2, "0");
    const id = index === 1 ? "teacher-demo" : `seed-teacher-${padded}`;
    const email = index === 1 ? "teacher@demo.edu.cn" : `teacher${padded}@demo.edu.cn`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: `测试教师${padded}`, password: teacherPassword, role: UserRole.TEACHER },
      create: { id, name: `测试教师${padded}`, email, password: teacherPassword, role: UserRole.TEACHER },
    });
    await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      update: { teacherId: `T2026${padded}`, department: "航空航天学院" },
      create: { userId: user.id, teacherId: `T2026${padded}`, department: "航空航天学院" },
    });
  }

  for (const [index, name] of courseNames.entries()) {
    const code = `AERO${String(index + 1).padStart(3, "0")}`;
    await prisma.course.upsert({
      where: { code },
      update: { name, department: "航空航天学院" },
      create: { code, name, department: "航空航天学院" },
    });
  }

  for (let index = 0; index < 100; index += 1) {
    const student = students[index];
    const courseName = courseNames[index % courseNames.length];
    const score = 55 + ((index * 13) % 46);
    const knowledgePoint = knowledgePoints[index % knowledgePoints.length];
    const errorType = score >= 90 ? "无明显错误" : errorTypes[index % errorTypes.length];
    await prisma.submission.upsert({
      where: { id: `seed-submission-${String(index + 1).padStart(3, "0")}` },
      update: {},
      create: {
        id: `seed-submission-${String(index + 1).padStart(3, "0")}`,
        userId: student.id,
        studentName: student.name,
        studentId: `2026${String(index + 1).padStart(3, "0")}`,
        className: `航设${Math.ceil((index + 1) / 25)}班`,
        courseName,
        assignmentName: `${courseName}第${(index % 6) + 1}章训练`,
        problemImageName: `seed-problem-${index + 1}.png`,
        answerImageName: `seed-answer-${index + 1}.png`,
        problemImages: [`seed-problem-${index + 1}.png`],
        answerImages: [`seed-answer-${index + 1}.png`],
        gradingResult: `测试批改记录：${knowledgePoint}，得分 ${score}。`,
        aiResult: { summary: "Seed 测试批改结果", knowledgePoint, errorType },
        score,
        firstError: score >= 90 ? null : "解题步骤中存在可改进项",
        errorType,
        knowledgePoint,
        feedback: score >= 90 ? "掌握良好" : `建议强化${knowledgePoint}`,
      },
    });
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
