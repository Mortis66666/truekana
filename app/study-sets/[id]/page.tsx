import StudySetStudy from "@/components/study-set-study";

type Props = { params: Promise<{ id: string }> };

export default async function StudySetPage({ params }: Props) {
  const { id } = await params;
  return <StudySetStudy id={id} />;
}
