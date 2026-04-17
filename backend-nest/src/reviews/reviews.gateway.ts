import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { getCorsOrigins } from "../cors";

@WebSocketGateway({
  namespace: "/reviews",
  cors: { origin: getCorsOrigins(), credentials: true },
})
export class ReviewsGateway {
  @WebSocketServer()
  server!: Server;

  // clients call this to join a course-specific room
  @SubscribeMessage("joinCourse")
  handleJoinCourse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { courseCode: string },
  ) {
    if (!data?.courseCode) return;
    client.join(this.getCourseRoom(data.courseCode));
  }

  emitCourseChanged(courseCode: string) {
    this.server
      .to(this.getCourseRoom(courseCode))
      .emit("reviews.changed", { courseCode });
  }

  private getCourseRoom(courseCode: string) {
    return `course:${courseCode}`;
  }
}
