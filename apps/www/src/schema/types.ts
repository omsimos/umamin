import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class ErrorResponse {
  @Field(() => String, { nullable: true })
  error?: string | null;
}
