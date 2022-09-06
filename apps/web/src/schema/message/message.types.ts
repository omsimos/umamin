import { ObjectType, Field, ID, InputType } from 'type-graphql';
import { MaxLength, MinLength, IsNotEmpty } from 'class-validator';

@ObjectType()
export class Message {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => String, { nullable: true })
  reply: string | null;

  @Field(() => String)
  receiverMsg: string;

  @Field(() => String, { nullable: true })
  senderId: string | null;

  @Field(() => String)
  receiverId: string;

  @Field(() => Boolean)
  isOpened: boolean;

  @Field(() => Date)
  createdAt: Date;
}

@InputType()
export class SendMessageInput {
  @Field(() => String, { nullable: true })
  senderUsername: string;

  @IsNotEmpty()
  @Field(() => String)
  receiverUsername: string;

  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  @Field(() => String)
  content: string;

  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Field(() => String)
  receiverMsg: string;
}
