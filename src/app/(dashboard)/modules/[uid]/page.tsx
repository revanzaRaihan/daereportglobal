import { redirect } from 'next/navigation'

export default async function ModuleUidRedirectPage({
  params
}: {
  params: Promise<{ uid: string }>
}) {
  const { uid } = await params
  redirect(`/studio/modules/${uid}`)
}
