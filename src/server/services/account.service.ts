import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { http } from "../http";
import type { z } from "zod";
import type { profileUpdateSchema, settingsUpdateSchema } from "@/lib/validation/schemas";

export const BCRYPT_COST = 12;

let dummyHash: string | null = null;
/** Compare against a dummy hash for unknown emails so response time does not reveal which emails exist. */
function getDummyHash() {
  dummyHash ??= bcrypt.hashSync("not-a-real-password-" + Math.random(), BCRYPT_COST);
  return dummyHash;
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw http.conflict("An account with this email already exists");
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  // A concurrent registration with the same email loses on the unique index (P2002 → 409).
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, settings: { create: {} } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return user;
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !ok) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true, settings: true },
  });
  if (!user) throw http.notFound("User");
  if (!user.settings) {
    const settings = await prisma.userSettings.create({ data: { userId } });
    return { ...user, settings };
  }
  return user;
}

export async function updateProfile(userId: string, input: z.output<typeof profileUpdateSchema>) {
  const data: { name?: string; passwordHash?: string } = {};
  if (input.name) data.name = input.name;
  if (input.newPassword) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(input.currentPassword ?? "", user.passwordHash))) {
      throw http.unprocessable("Current password is incorrect", { currentPassword: "Incorrect password" });
    }
    data.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);
  }
  return prisma.user.update({ where: { id: userId }, data, select: { id: true, name: true, email: true, role: true } });
}

export async function getSettings(userId: string) {
  return prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function updateSettings(userId: string, input: z.output<typeof settingsUpdateSchema>) {
  return prisma.userSettings.upsert({ where: { userId }, create: { userId, ...input }, update: input });
}

/** GDPR-style self-service deletion; cascades remove every private record (see DATABASE.md). */
export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(password, user.passwordHash))) throw http.unprocessable("Password is incorrect");
  await prisma.user.delete({ where: { id: userId } });
}
