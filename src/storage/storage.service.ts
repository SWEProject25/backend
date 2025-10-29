import { Injectable, NotFoundException } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';

@Injectable()
export class StorageService {
	private blobServiceClient: BlobServiceClient;
	private containerName: string;

	constructor(private configService: ConfigService) {
		const connectionString = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING') as string;
		this.containerName = this.configService.get<string>('AZURE_STORAGE_CONTAINER_NAME') || 'media';
		this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
	}

	async uploadFiles(files?: Express.Multer.File[]): Promise<string[]> {
		if (!files || files.length === 0) return [];
		const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
		await containerClient.createIfNotExists({ access: 'container' });

		const uploads = files.map(async (file) => {
			const fileExt = extname(file.originalname);
			const blobName = `${uuid()}${fileExt}`;
			const blockBlobClient = containerClient.getBlockBlobClient(blobName);

			await blockBlobClient.uploadData(file.buffer, {
				blobHTTPHeaders: { blobContentType: file.mimetype },
			});

			return blockBlobClient.url;
		});

		return await Promise.all(uploads);
	}
	
	async deleteFile(blobUrlOrName: string): Promise<void> {

		const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

		const blobName = blobUrlOrName.includes('/')
			? blobUrlOrName.split('/').pop()!
			: blobUrlOrName;

		const blobClient = containerClient.getBlobClient(blobName);

		const exists = await blobClient.exists();
		if (!exists) throw new NotFoundException(`File not found: ${blobName}`);

		await blobClient.deleteIfExists();
	}

	async deleteFiles(blobUrlsOrNames: string[]): Promise<void> {
		if (!blobUrlsOrNames || blobUrlsOrNames.length === 0) return;

		await Promise.all(blobUrlsOrNames.map((url) => this.deleteFile(url)));
	}
}
