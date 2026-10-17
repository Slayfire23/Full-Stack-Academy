import { z } from "zod";
import { route, parseBody, parseQuery, http } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { idSchema, questionInputSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db";
import { deleteQuestion, updateQuestion } from "@/server/services/admin.service";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Question");
  const question = await prisma.question.findFirst({ where: { id: params.id, ownerId: null }, include: { topic: { select: { id: true, title: true } } } });
  if (!question) throw http.notFound("Question");
  return { question };
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Question");
  const input = await parseBody(req, questionInputSchema);
  return updateQuestion(params.id, input);
});

const delQuery = z.object({ force: z.enum(["true", "false"]).optional().transform((v) => v === "true") });

/** Questions with learner history are unpublished unless ?force=true. */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!idSchema.safeParse(params.id).success) throw http.notFound("Question");
  const { force } = parseQuery(req, delQuery);
  return deleteQuestion(params.id, force);
});
