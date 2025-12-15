import { Injectable, NotFoundException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { v4 as uuid } from 'uuid';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'hankers-uploads-prod';
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    // No credentials needed for public bucket
    this.s3Client = new S3Client({
      region: this.region,
    });
  }

  async uploadFiles(files?: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];

    const uploads = files.map(async (file) => {
      const fileExt = extname(file.originalname);
      const key = `${uuid()}${fileExt}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      // Return the public S3 URL
      return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    });

    return await Promise.all(uploads);
  }

  async deleteFile(s3UrlOrKey: string): Promise<void> {
    // Extract key from S3 URL or use as-is if it's already a key
    const key = s3UrlOrKey.includes('/') ? s3UrlOrKey.split('/').pop()! : s3UrlOrKey;

    try {
      // Check if object exists
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(headCommand);

      // Delete the object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(deleteCommand);
    } catch (error: any) {
      if (error.name === 'NotFound') {
        throw new NotFoundException(`File not found: ${key}`);
      }
      throw error;
    }
  }

  async deleteFiles(s3UrlsOrKeys: string[]): Promise<void> {
    if (!s3UrlsOrKeys || s3UrlsOrKeys.length === 0) return;

    await Promise.all(s3UrlsOrKeys.map((url) => this.deleteFile(url)));
  }
}
