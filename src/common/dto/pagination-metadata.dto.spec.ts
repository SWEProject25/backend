import { PaginationMetadataDto } from './pagination-metadata.dto';

describe('PaginationMetadataDto', () => {
  it('should create an instance with all properties', () => {
    const dto = new PaginationMetadataDto();
    dto.totalItems = 100;
    dto.page = 1;
    dto.limit = 10;
    dto.totalPages = 10;

    expect(dto.totalItems).toBe(100);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(dto.totalPages).toBe(10);
  });

  it('should allow setting properties', () => {
    const dto = new PaginationMetadataDto();
    dto.totalItems = 50;
    dto.page = 2;
    dto.limit = 25;
    dto.totalPages = 2;

    expect(dto.totalItems).toBe(50);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
    expect(dto.totalPages).toBe(2);
  });

  it('should handle zero values', () => {
    const dto = new PaginationMetadataDto();
    dto.totalItems = 0;
    dto.page = 1;
    dto.limit = 10;
    dto.totalPages = 0;

    expect(dto.totalItems).toBe(0);
    expect(dto.totalPages).toBe(0);
  });

  it('should handle large values', () => {
    const dto = new PaginationMetadataDto();
    dto.totalItems = 1000000;
    dto.page = 5000;
    dto.limit = 100;
    dto.totalPages = 10000;

    expect(dto.totalItems).toBe(1000000);
    expect(dto.page).toBe(5000);
    expect(dto.totalPages).toBe(10000);
  });
});
