interface TempCourseObjectProps {
  userFavorite: {
    userId: string;
    createdAt: Date;
    favoriteCourse: string;
  };
}

export default function TempCourseObject({
  userFavorite,
}: TempCourseObjectProps) {
  return (
    <div className="p-2 border rounded mb-2">
      <span>{userFavorite.favoriteCourse}</span>
    </div>
  );
}
