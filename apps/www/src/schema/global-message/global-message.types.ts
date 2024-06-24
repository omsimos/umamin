import { ObjectType, Field, ID, InputType, Directive } from 'type-graphql';
import { MaxLength, MinLength, IsNotEmpty } from 'class-validator';
import { ErrorResponse } from '../types';

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
export class GlobalMessagesData {
  @Field(() => [GlobalMessage])
  data: GlobalMessage[];

  @Field(() => String, { nullable: true })
  cursorId: string | null;
}

@ObjectType()
export class SendGlobalMessage extends ErrorResponse {
  @Field(() => GlobalMessage, { nullable: true })
  data?: GlobalMessage | null;
}

@InputType()
export class SendGlobalMessageInput {
  @Field(() => ID)
  userId: string;

  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  @Field(() => String)
  content: string;

  @Field(() => Boolean)
  isAnonymous: boolean;
}
