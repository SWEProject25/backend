import {
  GetSuggestedUsersQueryDto,
  SuggestedUserDto,
  SuggestedUsersResponseDto,
} from './suggested-users.dto';
import { plainToInstance } from 'class-transformer';

describe('GetSuggestedUsersQueryDto', () => {
  it('should create an instance with default values', () => {
    const dto = new GetSuggestedUsersQueryDto();

    expect(dto.limit).toBe(10);
    expect(dto.excludeFollowed).toBeUndefined();
    expect(dto.excludeBlocked).toBeUndefined();
  });

  it('should create an instance with custom limit', () => {
    const dto = new GetSuggestedUsersQueryDto();
    dto.limit = 25;

    expect(dto.limit).toBe(25);
  });

  it('should create an instance with excludeFollowed set', () => {
    const dto = new GetSuggestedUsersQueryDto();
    dto.excludeFollowed = true;

    expect(dto.excludeFollowed).toBe(true);
  });

  it('should create an instance with excludeBlocked set', () => {
    const dto = new GetSuggestedUsersQueryDto();
    dto.excludeBlocked = false;

    expect(dto.excludeBlocked).toBe(false);
  });

  it('should create an instance with all parameters', () => {
    const dto = new GetSuggestedUsersQueryDto();
    dto.limit = 50;
    dto.excludeFollowed = true;
    dto.excludeBlocked = true;

    expect(dto.limit).toBe(50);
    expect(dto.excludeFollowed).toBe(true);
    expect(dto.excludeBlocked).toBe(true);
  });

  it('should accept minimum limit value', () => {
    const dto = new GetSuggestedUsersQueryDto();
    dto.limit = 1;

    expect(dto.limit).toBe(1);
  });

  it('should accept maximum limit value', () => {
    const dto = new GetSuggestedUsersQueryDto();
    dto.limit = 50;

    expect(dto.limit).toBe(50);
  });

  it('should handle Type transformation for limit', () => {
    const plain = { limit: '20' };
    const dto = plainToInstance(GetSuggestedUsersQueryDto, plain);

    expect(dto.limit).toBe(20);
  });

  it('should handle Type transformation for excludeFollowed', () => {
    const plain = { excludeFollowed: 'true' };
    const dto = plainToInstance(GetSuggestedUsersQueryDto, plain);

    expect(dto.excludeFollowed).toBe(true);
  });

  it('should handle Type transformation for excludeBlocked', () => {
    const plain = { excludeBlocked: 'true' };
    const dto = plainToInstance(GetSuggestedUsersQueryDto, plain);

    expect(dto.excludeBlocked).toBe(true);
  });
});

describe('SuggestedUserDto', () => {
  it('should create an instance', () => {
    const dto = new SuggestedUserDto();
    dto.id = 1;
    dto.username = 'john_doe';
    dto.email = 'john.doe@example.com';
    dto.profile = {
      name: 'John Doe',
      bio: 'Software Engineer | Tech Enthusiast',
      profileImageUrl: 'https://example.com/profile.jpg',
      bannerImageUrl: 'https://example.com/banner.jpg',
      website: 'https://johndoe.com',
    };
    dto.followersCount = 15240;
    dto.isVerified = false;

    expect(dto.id).toBe(1);
    expect(dto.username).toBe('john_doe');
    expect(dto.email).toBe('john.doe@example.com');
    expect(dto.profile).toBeDefined();
    expect(dto.profile?.name).toBe('John Doe');
    expect(dto.followersCount).toBe(15240);
    expect(dto.isVerified).toBe(false);
  });

  it('should allow null profile', () => {
    const dto = new SuggestedUserDto();
    dto.id = 1;
    dto.username = 'john_doe';
    dto.email = 'john.doe@example.com';
    dto.profile = null;
    dto.followersCount = 0;
    dto.isVerified = false;

    expect(dto.profile).toBeNull();
  });

  it('should allow verified user', () => {
    const dto = new SuggestedUserDto();
    dto.id = 1;
    dto.username = 'verified_user';
    dto.email = 'verified@example.com';
    dto.profile = null;
    dto.followersCount = 100000;
    dto.isVerified = true;

    expect(dto.isVerified).toBe(true);
  });

  it('should allow null profile fields', () => {
    const dto = new SuggestedUserDto();
    dto.id = 1;
    dto.username = 'john_doe';
    dto.email = 'john.doe@example.com';
    dto.profile = {
      name: 'John Doe',
      bio: null,
      profileImageUrl: null,
      bannerImageUrl: null,
      website: null,
    };
    dto.followersCount = 0;
    dto.isVerified = false;

    expect(dto.profile.bio).toBeNull();
    expect(dto.profile.profileImageUrl).toBeNull();
    expect(dto.profile.bannerImageUrl).toBeNull();
    expect(dto.profile.website).toBeNull();
  });
});

describe('SuggestedUsersResponseDto', () => {
  it('should create an instance', () => {
    const dto = new SuggestedUsersResponseDto();
    dto.status = 'success';
    dto.data = { users: [] };
    dto.total = 10;
    dto.message = 'Successfully retrieved suggested users';

    expect(dto.status).toBe('success');
    expect(dto.data).toEqual({ users: [] });
    expect(dto.total).toBe(10);
    expect(dto.message).toBe('Successfully retrieved suggested users');
  });

  it('should contain users array in data', () => {
    const dto = new SuggestedUsersResponseDto();
    const user = new SuggestedUserDto();
    user.id = 1;
    user.username = 'john_doe';
    user.email = 'john.doe@example.com';
    user.profile = null;
    user.followersCount = 100;
    user.isVerified = false;

    dto.status = 'success';
    dto.data = { users: [user] };
    dto.total = 1;
    dto.message = 'Successfully retrieved suggested users';

    expect(dto.data.users.length).toBe(1);
    expect(dto.data.users[0].id).toBe(1);
  });
});
