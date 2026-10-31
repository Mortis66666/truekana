import StudySetEditor from "@/components/study-set-editor";

type Props = { params: Promise<{ id: string }> };

export default async function StudySetSettingsPage({ params }: Props) {
  const { id } = await params;
  return <StudySetEditor id={id} />;
}
