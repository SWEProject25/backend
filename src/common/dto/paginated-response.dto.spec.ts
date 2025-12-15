import { PaginatedResponseDto } from './paginated-response.dto';
import { PaginationMetadataDto } from './pagination-metadata.dto';

describe('PaginatedResponseDto', () => {
  it('should create an instance with all properties', () => {
    const dto = new PaginatedResponseDto<{ id: number }>();
    dto.status = 'success';
    dto.message = 'Data retrieved successfully';
    dto.data = [{ id: 1 }, { id: 2 }];
    dto.metadata = {
      totalItems: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    expect(dto.status).toBe('success');
    expect(dto.message).toBe('Data retrieved successfully');
    expect(dto.data).toHaveLength(2);
    expect(dto.metadata.totalItems).toBe(2);
  });

  it('should work with string data type', () => {
    const dto = new PaginatedResponseDto<string>();
    dto.status = 'success';
    dto.message = 'Strings retrieved';
    dto.data = ['item1', 'item2', 'item3'];
    dto.metadata = {
      totalItems: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    expect(dto.data).toEqual(['item1', 'item2', 'item3']);
  });

  it('should handle empty data array', () => {
    const dto = new PaginatedResponseDto<any>();
    dto.status = 'success';
    dto.message = 'No data found';
    dto.data = [];
    dto.metadata = {
      totalItems: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    };

    expect(dto.data).toHaveLength(0);
    expect(dto.metadata.totalItems).toBe(0);
  });

  it('should work with complex object types', () => {
    interface User {
      id: number;
      name: string;
      email: string;
    }

    const dto = new PaginatedResponseDto<User>();
    dto.status = 'success';
    dto.message = 'Users retrieved';
    dto.data = [
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 2, name: 'Jane', email: 'jane@example.com' },
    ];
    dto.metadata = {
      totalItems: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    expect(dto.data[0].name).toBe('John');
    expect(dto.data[1].email).toBe('jane@example.com');
  });

  it('should work with PaginationMetadataDto instance', () => {
    const metadata = new PaginationMetadataDto();
    metadata.totalItems = 50;
    metadata.page = 2;
    metadata.limit = 25;
    metadata.totalPages = 2;

    const dto = new PaginatedResponseDto<number>();
    dto.status = 'success';
    dto.message = 'Numbers retrieved';
    dto.data = [1, 2, 3];
    dto.metadata = metadata;

    expect(dto.metadata).toBe(metadata);
    expect(dto.metadata.page).toBe(2);
  });
});
