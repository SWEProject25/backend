import {
  InterestDto,
  GetInterestsResponseDto,
  SaveUserInterestsDto,
  UserInterestDto,
  GetUserInterestsResponseDto,
  SaveUserInterestsResponseDto,
  GetAllInterestsResponseDto,
} from './interest.dto';
import { plainToInstance } from 'class-transformer';

describe('InterestDto', () => {
  it('should create an instance', () => {
    const dto = new InterestDto();
    dto.id = 1;
    dto.name = 'Technology';
    dto.slug = 'technology';
    dto.description = 'Stay updated with the latest tech trends';
    dto.icon = '💻';

    expect(dto.id).toBe(1);
    expect(dto.name).toBe('Technology');
    expect(dto.slug).toBe('technology');
    expect(dto.description).toBe('Stay updated with the latest tech trends');
    expect(dto.icon).toBe('💻');
  });

  it('should allow null values for optional fields', () => {
    const dto = new InterestDto();
    dto.id = 1;
    dto.name = 'Technology';
    dto.slug = 'technology';
    dto.description = null;
    dto.icon = null;

    expect(dto.description).toBeNull();
    expect(dto.icon).toBeNull();
  });
});

describe('GetInterestsResponseDto', () => {
  it('should create an instance', () => {
    const dto = new GetInterestsResponseDto();
    dto.status = 'success';
    dto.message = 'Successfully retrieved interests';
    dto.data = [];
    dto.total = 12;

    expect(dto.status).toBe('success');
    expect(dto.message).toBe('Successfully retrieved interests');
    expect(dto.data).toEqual([]);
    expect(dto.total).toBe(12);
  });
});

describe('SaveUserInterestsDto', () => {
  it('should create an instance with interest IDs', () => {
    const dto = new SaveUserInterestsDto();
    dto.interestIds = [1, 2, 3, 5, 8];

    expect(dto.interestIds).toEqual([1, 2, 3, 5, 8]);
    expect(dto.interestIds.length).toBe(5);
  });

  it('should allow a single interest ID', () => {
    const dto = new SaveUserInterestsDto();
    dto.interestIds = [1];

    expect(dto.interestIds).toEqual([1]);
    expect(dto.interestIds.length).toBe(1);
  });

  it('should handle Type transformation', () => {
    const plain = { interestIds: ['1', '2', '3'] };
    const dto = plainToInstance(SaveUserInterestsDto, plain);

    expect(dto.interestIds).toEqual([1, 2, 3]);
  });
});

describe('UserInterestDto', () => {
  it('should create an instance', () => {
    const dto = new UserInterestDto();
    dto.id = 1;
    dto.name = 'Technology';
    dto.slug = 'technology';
    dto.icon = '💻';
    dto.selectedAt = new Date('2025-11-18T09:17:32.000Z');

    expect(dto.id).toBe(1);
    expect(dto.name).toBe('Technology');
    expect(dto.slug).toBe('technology');
    expect(dto.icon).toBe('💻');
    expect(dto.selectedAt).toEqual(new Date('2025-11-18T09:17:32.000Z'));
  });

  it('should allow null icon', () => {
    const dto = new UserInterestDto();
    dto.id = 1;
    dto.name = 'Technology';
    dto.slug = 'technology';
    dto.icon = null;
    dto.selectedAt = new Date();

    expect(dto.icon).toBeNull();
  });
});

describe('GetUserInterestsResponseDto', () => {
  it('should create an instance', () => {
    const dto = new GetUserInterestsResponseDto();
    dto.status = 'success';
    dto.message = 'Successfully retrieved user interests';
    dto.data = [];
    dto.total = 5;

    expect(dto.status).toBe('success');
    expect(dto.message).toBe('Successfully retrieved user interests');
    expect(dto.data).toEqual([]);
    expect(dto.total).toBe(5);
  });
});

describe('SaveUserInterestsResponseDto', () => {
  it('should create an instance', () => {
    const dto = new SaveUserInterestsResponseDto();
    dto.status = 'success';
    dto.message = 'Interests saved successfully. Please follow some users to complete onboarding.';
    dto.savedCount = 5;

    expect(dto.status).toBe('success');
    expect(dto.message).toBe(
      'Interests saved successfully. Please follow some users to complete onboarding.',
    );
    expect(dto.savedCount).toBe(5);
  });
});

describe('GetAllInterestsResponseDto', () => {
  it('should create an instance', () => {
    const dto = new GetAllInterestsResponseDto();
    dto.status = 'success';
    dto.message = 'Successfully retrieved interests';
    dto.total = 16;
    dto.data = [];

    expect(dto.status).toBe('success');
    expect(dto.message).toBe('Successfully retrieved interests');
    expect(dto.total).toBe(16);
    expect(dto.data).toEqual([]);
  });
});
