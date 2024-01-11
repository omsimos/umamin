import { ObjectType, Field, ID, InputType, Directive } from 'type-graphql';
import { MaxLength, MinLength, IsNotEmpty } from 'class-validator';

@Directive('@cacheControl(maxAge: 86400)')
@ObjectType()
class Message {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => String)
  receiverMsg: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => String, { nullable: true })
  reply: string | null;

  @Field(() => String, { nullable: true })
  clue: string | null;

  @Field(() => String, { nullable: true })
  receiverUsername: string | null;
}

@ObjectType()
export class MessagesData {
  @Field(() => [Message])
  data: Message[];

  @Field(() => String, { nullable: true })
  cursorId: string | null;
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
