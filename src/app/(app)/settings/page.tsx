import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getProfile } from "@/server/services/account.service";
import { PageHeader } from "@/components/ui/primitives";
import { DeleteAccount, PreferencesForm, ProfileForm } from "@/components/settings/forms";
import { logoutAction } from "../../(auth)/actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${profile.email}.`} />
      <div className="grid max-w-3xl gap-4">
        <PreferencesForm initial={profile.settings} />
        <ProfileForm name={profile.name} />
        <DeleteAccount logout={logoutAction} />
      </div>
    </>
  );
}
