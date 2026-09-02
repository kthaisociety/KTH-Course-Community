"use client";

import TempCourseObject from "@/components/tempCourseObject";

interface UserViewProps {
  name: string;
  favorites: string[];
  userId: string;
}

export default function UserView(props: UserViewProps) {
  const displayFavorites = () => {
    if (props.favorites.length > 0) {
      return (
        <div>
          {props.favorites.map((favorite) => (
            <TempCourseObject
              key={favorite.toString()}
              userFavorite={{
                userId: props.userId,
                createdAt: new Date(),
                favoriteCourse: favorite,
              }}
            />
          ))}
        </div>
      );
    }
    return <div> User has not favorite courses</div>;
  };
  return (
    <div>
      <h1 className="text-secondary font-extrabold text-4xl">
        Welcome {props.name}!
      </h1>
      <div>
        <h2>Your favorite courses</h2>
        {displayFavorites()}
      </div>
    </div>
  );
}
