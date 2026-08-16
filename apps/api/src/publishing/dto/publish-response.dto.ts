import { ApiProperty } from '@nestjs/swagger';
import { PostResponseDto } from '../../posts/dto/post-response.dto';
import { PublishAttemptResponseDto } from './publish-attempt-response.dto';

export class PublishResponseDto {
  @ApiProperty({
    type: PostResponseDto,
    description: 'Updated post details with final status',
  })
  post: PostResponseDto;

  @ApiProperty({
    type: PublishAttemptResponseDto,
    description: 'Details of the executed publish attempt',
  })
  attempt: PublishAttemptResponseDto;
}
