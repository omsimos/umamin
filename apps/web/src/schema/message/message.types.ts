import { ObjectType, Field, ID, InputType, Directive } from 'type-graphql';
import { MaxLength, MinLength, IsNotEmpty } from 'class-validator';
import { ErrorResponse } from '../types';

@ObjectType()
export class BaseMessage {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => String)
  receiverMsg: string;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
class GlobalMessageUser {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  username: string | null;

  @Field(() => String, { nullable: true })
  image: string | null;
}

@Directive('@cacheControl(maxAge: 86400)')
@ObjectType()
export class GlobalMessage {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => Boolean)
  isAnonymous: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => GlobalMessageUser, { nullable: true })
  user: GlobalMessageUser | null;
}

@ObjectType()
export class SendGlobalMessage extends ErrorResponse {
  @Field(() => GlobalMessage, { nullable: true })
  data?: GlobalMessage | null;
}

@Directive('@cacheControl(maxAge: 60)')
@ObjectType()
export class RecentMessage extends BaseMessage {
  @Field(() => String, { nullable: true })
  clue: string | null;
}

@ObjectType()
export class SeenMessage extends BaseMessage {
  @Field(() => ID)
  id: string;

  @Directive('@cacheControl(maxAge: 86400)')
  @Field(() => String)
  content: string;

  @Directive('@cacheControl(maxAge: 86400)')
  @Field(() => String)
  receiverMsg: string;

  @Directive('@cacheControl(maxAge: 86400)')
  @Field(() => Date)
  createdAt: Date;

  @Field(() => String, { nullable: true })
  reply: string | null;

  @Directive('@cacheControl(maxAge: 86400)')
  @Field(() => String, { nullable: true })
  clue: string | null;
}

@Directive('@cacheControl(maxAge: 120)')
@ObjectType()
export class SentMessage extends BaseMessage {
  @Field(() => String, { nullable: true })
  receiverUsername: string | null;

  @Field(() => String, { nullable: true })
  reply: string | null;

  @Field(() => String, { nullable: true })
  clue: string | null;
}

@InputType()
export class SendMessageInput {
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

  @MaxLength(100)
  @Field(() => String, { nullable: true })
  clue: string | null;

  @IsNotEmpty()
  @Field(() => String)
  receiverUsername: string;
}

@InputType()
export class SendGlobalMessageInput {
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  @Field(() => String)
  content: string;

  @Field(() => Boolean)
  isAnonymous: boolean;
}
