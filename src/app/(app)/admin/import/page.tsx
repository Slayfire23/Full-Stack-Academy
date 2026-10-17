import type { Metadata } from "next";
import { requireAdminPage } from "@/server/session";
import { PageHeader } from "@/components/ui/primitives";
import { ImportForm } from "@/components/admin/import-form";

export const metadata: Metadata = { title: "Import — Admin" };

export default async function ImportPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Import questions" description="Up to 500 questions per file. Reference topics by topicSlug (e.g. http, idempotency) or topicId." />
      <ImportForm />
    </>
  );
}
