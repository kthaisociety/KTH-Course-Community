import { Course } from "@/features/courses/components/course";

type PageProps = {
  params: Promise<{ courseCode: string }>;
  searchParams: Promise<{
    from?: string | string[];
    writeReview?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { courseCode } = await params;
  const query = await searchParams;
  return (
    <Course
      courseCode={courseCode}
      fromSaved={first(query.from) === "saved"}
      openReviewOnLoad={first(query.writeReview) === "1"}
    />
  );
}
