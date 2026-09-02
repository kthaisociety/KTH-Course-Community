import Link from "next/link";

export default function CourseNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <p className="text-destructive text-lg font-medium">
        Could not load this course.
      </p>
      <p className="mt-2 text-muted-foreground text-sm">
        This course was not found.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-block text-primary text-sm underline"
      >
        Back to explore
      </Link>
    </div>
  );
}
