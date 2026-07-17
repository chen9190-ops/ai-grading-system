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
  const studentPassword = await hash(requiredEnv("SEED_STUDENT_PASSWORD"), 12);
  const teacherPassword = await hash(requiredEnv("SEED_TEACHER_PASSWORD"), 12);
  const adminPassword = await hash(requiredEnv("SEED_ADMIN_PASSWORD"), 12);

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

  const teachers = [];
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
    teachers.push(user);
  }

  for (const [index, name] of courseNames.entries()) {
    const code = `AERO${String(index + 1).padStart(3, "0")}`;
    await prisma.course.upsert({
      where: { code },
      update: { name, department: "航空航天学院" },
      create: { code, name, department: "航空航天学院" },
    });
  }

  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const sequence = studentIndex * 3 + attempt;
      const submissionId = `seed-submission-${String(sequence).padStart(3, "0")}`;
      const courseName = courseNames[(studentIndex + attempt - 1) % courseNames.length];
      const score = Math.round((5.2 + ((studentIndex * 11 + attempt * 7) % 49) / 10) * 10) / 10;
      const knowledgePoint = knowledgePoints[(studentIndex + attempt) % knowledgePoints.length];
      const errorType = score >= 9 ? "无明显错误" : errorTypes[(studentIndex + attempt) % errorTypes.length];
      const createdAt = demoDate((sequence - 1) % 21, (studentIndex + attempt) % 12 + 8);
      const data = {
        userId: student.id,
        studentName: student.name,
        studentId: `2026${String(studentIndex + 1).padStart(3, "0")}`,
        className: `航设${Math.ceil((studentIndex + 1) / 25)}班`,
        courseName,
        assignmentName: `${courseName}第${((studentIndex + attempt) % 6) + 1}章训练`,
        problemImageName: `seed/${courseName}/problem-${sequence}.png`,
        answerImageName: `seed/${courseName}/answer-${sequence}.png`,
        problemImages: [`seed/${courseName}/problem-${sequence}.png`],
        answerImages: [`seed/${courseName}/answer-${sequence}.png`],
        gradingResult: `AI 批改：${knowledgePoint}，得分 ${score} / 10。${score >= 9 ? "解题规范，步骤完整。" : `主要问题为${errorType}。`}`,
        aiResult: { summary: "高校教学演示批改结果", knowledgePoint, errorType, score },
        score,
        firstError: score >= 9 ? null : `在${knowledgePoint}相关步骤出现${errorType}`,
        errorType,
        knowledgePoint,
        feedback: score >= 9 ? "掌握良好，建议挑战综合题" : `建议复习${knowledgePoint}并完成针对性训练`,
        createdAt,
      };
      await prisma.submission.upsert({
        where: { id: submissionId },
        update: data,
        create: {
          id: submissionId,
          ...data,
        },
      });
    }

    for (const [conversationIndex, type] of ["MECHANICS_ASSISTANT", "EXAM_GENERATOR"].entries()) {
      const id = `seed-conversation-${String(studentIndex + 1).padStart(3, "0")}-${conversationIndex + 1}`;
      const topic = knowledgePoints[(studentIndex + conversationIndex) % knowledgePoints.length];
      const data = {
        userId: student.id,
        type,
        question: type === "MECHANICS_ASSISTANT" ? `请解释${topic}的核心概念与常用公式` : `生成一道${topic}基础训练题`,
        answer: type === "MECHANICS_ASSISTANT" ? `${topic}需要结合定义、方向和适用条件分步理解。` : `已生成${topic}训练题及参考答案。`,
        knowledgeUsed: { topic, source: "seed-demo" },
        createdAt: demoDate((studentIndex + conversationIndex) % 14, 10 + conversationIndex),
      };
      await prisma.aIConversation.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
  }

  for (let teacherIndex = 0; teacherIndex < teachers.length; teacherIndex += 1) {
    const teacher = teachers[teacherIndex];
    for (let paperIndex = 1; paperIndex <= 3; paperIndex += 1) {
      const id = `seed-exam-${String(teacherIndex + 1).padStart(2, "0")}-${paperIndex}`;
      const courseName = courseNames[(teacherIndex * 2 + paperIndex - 1) % courseNames.length];
      const data = {
        teacherId: teacher.id,
        courseName,
        chapter: `第${paperIndex + 1}章 核心概念`,
        difficulty: ["基础", "中等", "提高"][paperIndex - 1],
        questionCount: 5,
        questions: Array.from({ length: 5 }, (_, index) => ({ number: index + 1, title: `${courseName}演示题 ${index + 1}`, score: 20 })),
        answer: Array.from({ length: 5 }, (_, index) => ({ number: index + 1, key: `参考解答 ${index + 1}` })),
        createdAt: demoDate((teacherIndex + paperIndex) % 10, 9 + paperIndex),
      };
      await prisma.examPaper.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (let reportIndex = 1; reportIndex <= 2; reportIndex += 1) {
      const id = `seed-report-${String(teacherIndex + 1).padStart(2, "0")}-${reportIndex}`;
      const courseName = courseNames[(teacherIndex + reportIndex - 1) % courseNames.length];
      const data = {
        teacherId: teacher.id,
        courseName,
        inputData: { studentCount: 25, submissionCount: 75, averageScore: 7.8 + (teacherIndex % 6) / 10 },
        report: { classSummary: `${courseName}整体掌握稳定`, mainIssues: errorTypes.slice(0, 2), weakKnowledgePoints: knowledgePoints.slice(reportIndex, reportIndex + 2), teachingSuggestions: "加强分层练习与错题复盘", nextStagePlan: "开展章节综合训练" },
        createdAt: demoDate((teacherIndex + reportIndex * 2) % 14, 14),
      };
      await prisma.teachingReport.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
  }
}

function demoDate(daysAgo, hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured before running prisma db seed`);
  return value;
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
