import { IsNotEmpty,IsOptional } from 'class-validator';

export class QueryDto {
  @IsNotEmpty({ message: 'email is required' })
  promt: string;

  @IsOptional()
  chatId:string;
}
