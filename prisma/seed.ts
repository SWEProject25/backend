import { PrismaClient, PostType, PostVisibility, MediaType, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Define types
type CreatedUser = {
  id: number;
  email: string;
  username: string;
  password: string;
  is_verified: boolean;
  provider_id: string | null;
  role: Role;
  has_completed_interests: boolean;
  has_completed_following: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  Profile: any;
};

type CreatedInterest = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type CreatedPost = {
  id: number;
  user_id: number;
  content: string;
  type: PostType;
  parent_id: number | null;
  visibility: PostVisibility;
  created_at: Date;
  is_deleted: boolean;
};

type CreatedHashtag = {
  id: number;
  tag: string;
  created_at: Date;
};

type CreatedConversation = {
  id: number;
  user1Id: number;
  user2Id: number;
  createdAt: Date;
  updatedAt: Date | null;
};

// Sample data
const interests = [
  { name: 'News', slug: 'news', icon: '📰', description: 'Stay updated with current events' },
  {
    name: 'Sports',
    slug: 'sports',
    icon: '⚽',
    description: 'Follow your favorite sports and teams',
  },
  { name: 'Music', slug: 'music', icon: '🎵', description: 'Discover new music and artists' },
  {
    name: 'Dance',
    slug: 'dance',
    icon: '💃',
    description: 'Explore dance styles and performances',
  },
  { name: 'Celebrity', slug: 'celebrity', icon: '⭐', description: 'Keep up with celebrity news' },
  {
    name: 'Relationships',
    slug: 'relationships',
    icon: '❤️',
    description: 'Dating, love, and relationship advice',
  },
  { name: 'Movies & TV', slug: 'movies-tv', icon: '🎬', description: 'Latest in entertainment' },
  { name: 'Technology', slug: 'technology', icon: '💻', description: 'Tech news and innovations' },
  {
    name: 'Business & Finance',
    slug: 'business-finance',
    icon: '💼',
    description: 'Business trends and financial news',
  },
  { name: 'Gaming', slug: 'gaming', icon: '🎮', description: 'Video games and esports' },
  { name: 'Fashion', slug: 'fashion', icon: '👗', description: 'Style trends and fashion news' },
  { name: 'Food', slug: 'food', icon: '🍕', description: 'Recipes and culinary adventures' },
  { name: 'Travel', slug: 'travel', icon: '✈️', description: 'Travel tips and destinations' },
  { name: 'Fitness', slug: 'fitness', icon: '💪', description: 'Health and fitness tips' },
  {
    name: 'Science',
    slug: 'science',
    icon: '🔬',
    description: 'Scientific discoveries and research',
  },
  { name: 'Art', slug: 'art', icon: '🎨', description: 'Visual arts and creativity' },
];

const sampleUsers = [
  {
    email: 'mohamed-sameh-albaz@example.com',
    username: 'mohamed-sameh-albaz',
    password: 'Password123!',
    profile: {
      name: 'Mohamed Sameh Albaz',
      bio: 'Software Engineer | Full-stack Developer 💻 | Building amazing apps',
      location: 'Cairo, Egypt',
      website: 'https://mohamed-albaz.dev',
      birth_date: new Date('1995-01-15'),
    },
    interests: ['Technology', 'Gaming', 'Science'],
    hasCompletedOnboarding: true,
    role: 'ADMIN' as Role,
  },
  {
    email: 'john.doe@example.com',
    username: 'john_doe',
    password: 'Password123!',
    profile: {
      name: 'John Doe',
      bio: 'Tech enthusiast | Coffee lover ☕ | Building cool stuff',
      location: 'San Francisco, CA',
      website: 'https://johndoe.dev',
      birth_date: new Date('1990-05-15'),
    },
    interests: ['Technology', 'Gaming', 'Science'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'jane.smith@example.com',
    username: 'jane_smith',
    password: 'Password123!',
    profile: {
      name: 'Jane Smith',
      bio: 'Designer | Creative soul 🎨 | Living life in colors',
      location: 'New York, NY',
      website: 'https://janesmith.design',
      birth_date: new Date('1992-08-22'),
    },
    interests: ['Art', 'Fashion', 'Travel'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'alex.johnson@example.com',
    username: 'alex_codes',
    password: 'Password123!',
    profile: {
      name: 'Alex Johnson',
      bio: 'Full-stack developer | Open source contributor 💻',
      location: 'Austin, TX',
      website: 'https://github.com/alexjohnson',
      birth_date: new Date('1995-03-10'),
    },
    interests: ['Technology', 'Music', 'Fitness'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'sarah.williams@example.com',
    username: 'sarah_fit',
    password: 'Password123!',
    profile: {
      name: 'Sarah Williams',
      bio: 'Fitness coach | Nutrition expert 💪 | Health is wealth',
      location: 'Los Angeles, CA',
      website: 'https://sarahfitness.com',
      birth_date: new Date('1988-11-30'),
    },
    interests: ['Fitness', 'Food', 'Relationships'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'mike.brown@example.com',
    username: 'mike_sports',
    password: 'Password123!',
    profile: {
      name: 'Mike Brown',
      bio: 'Sports journalist | Football fanatic ⚽ | Never miss a game',
      location: 'Chicago, IL',
      website: null,
      birth_date: new Date('1985-07-18'),
    },
    interests: ['Sports', 'News', 'Travel'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'emily.davis@example.com',
    username: 'emily_chef',
    password: 'Password123!',
    profile: {
      name: 'Emily Davis',
      bio: 'Chef | Food blogger 🍕 | Cooking with love',
      location: 'Portland, OR',
      website: 'https://emilyskitchen.com',
      birth_date: new Date('1993-02-14'),
    },
    interests: ['Food', 'Travel', 'Art'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'david.miller@example.com',
    username: 'david_biz',
    password: 'Password123!',
    profile: {
      name: 'David Miller',
      bio: 'Entrepreneur | Investor 💼 | Building the future',
      location: 'Seattle, WA',
      website: 'https://davidmiller.biz',
      birth_date: new Date('1982-09-25'),
    },
    interests: ['Business & Finance', 'Technology', 'News'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'lisa.garcia@example.com',
    username: 'lisa_music',
    password: 'Password123!',
    profile: {
      name: 'Lisa Garcia',
      bio: 'Musician | Singer-songwriter 🎵 | Music is life',
      location: 'Nashville, TN',
      website: 'https://lisagarcia.music',
      birth_date: new Date('1996-12-05'),
    },
    interests: ['Music', 'Dance', 'Celebrity'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'tom.wilson@example.com',
    username: 'tom_gamer',
    password: 'Password123!',
    profile: {
      name: 'Tom Wilson',
      bio: "Pro gamer | Streamer 🎮 | Let's play!",
      location: 'Boston, MA',
      website: 'https://twitch.tv/tomwilson',
      birth_date: new Date('1998-04-20'),
    },
    interests: ['Gaming', 'Technology', 'Movies & TV'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
  {
    email: 'anna.lee@example.com',
    username: 'anna_travel',
    password: 'Password123!',
    profile: {
      name: 'Anna Lee',
      bio: 'Travel blogger | Adventure seeker ✈️ | 50 countries and counting',
      location: 'Miami, FL',
      website: 'https://annatravel.blog',
      birth_date: new Date('1991-06-08'),
    },
    interests: ['Travel', 'Food', 'Fashion'],
    hasCompletedOnboarding: true,
    role: 'USER' as Role,
  },
];

const samplePosts = [
  {
    content: 'Just launched my new app! Check it out 🚀',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Beautiful sunset today 🌅 #nature #photography',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Anyone else working on weekends? 💻',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'New blog post is live! Link in bio 📝',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Coffee and code. Perfect morning! ☕',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Just finished an amazing workout 💪 Feeling great!',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Game night with friends! 🎮',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Trying out a new recipe today 🍝',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: "What's everyone reading this week? 📚",
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Tech conference was mind-blowing! 🤯',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Learning something new every day 📚',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Best pizza in town! 🍕 You have to try this place',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'Morning run done! 5km in 30 minutes 🏃',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: 'New album dropping tonight! 🎵 So excited!',
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
  {
    content: "Just booked my next adventure ✈️ Can't wait!",
    type: PostType.POST,
    visibility: PostVisibility.EVERY_ONE,
  },
];

const hashtags = [
  'technology',
  'coding',
  'javascript',
  'react',
  'nodejs',
  'fitness',
  'health',
  'workout',
  'motivation',
  'travel',
  'adventure',
  'photography',
  'nature',
  'food',
  'cooking',
  'recipe',
  'foodie',
  'music',
  'art',
  'design',
  'creative',
  'business',
  'entrepreneur',
  'startup',
  'innovation',
  'gaming',
  'esports',
  'twitch',
  'streamer',
  'fashion',
  'style',
  'ootd',
  'trends',
];

async function main() {
  console.log('🌱 Starting database seeding...\n');
  console.log(`📅 Current Date: ${new Date().toISOString()}\n`);

  // Clear existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.userInterest.deleteMany();
  await prisma.mention.deleteMany();
  await prisma.like.deleteMany();
  await prisma.repost.deleteMany();
  await prisma.media.deleteMany();
  await prisma.$executeRaw`DELETE FROM "_PostHashtags"`;
  await prisma.hashtag.deleteMany();
  await prisma.post.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.block.deleteMany();
  await prisma.mute.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.interest.deleteMany();
  console.log('✅ Cleanup completed\n');

  // 1. Seed Interests
  console.log('📊 Seeding interests...');
  const createdInterests: CreatedInterest[] = [];
  for (const interest of interests) {
    const created = await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: {},
      create: interest,
    });
    createdInterests.push(created);
  }
  console.log(`✅ Created ${createdInterests.length} interests\n`);

  // 2. Seed Users with Profiles
  console.log('👥 Seeding users...');
  const createdUsers: CreatedUser[] = [];
  for (const userData of sampleUsers) {
    const hashedPassword = await argon2.hash(userData.password);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        password: hashedPassword,
        is_verified: true,
        role: userData.role,
        has_completed_interests: userData.hasCompletedOnboarding,
        has_completed_following: userData.hasCompletedOnboarding,
        Profile: {
          create: {
            name: userData.profile.name,
            bio: userData.profile.bio,
            location: userData.profile.location,
            website: userData.profile.website,
            birth_date: userData.profile.birth_date,
          },
        },
      },
      include: {
        Profile: true,
      },
    });

    createdUsers.push(user as CreatedUser);
    const roleEmoji = user.role === 'ADMIN' ? '👑' : '👤';
    console.log(`  ${roleEmoji} Created user: ${user.username} (${user.role})`);
  }
  console.log(`✅ Created ${createdUsers.length} users\n`);

  // 3. Seed User Interests
  console.log('🎯 Assigning interests to users...');
  let interestCount = 0;
  for (let i = 0; i < sampleUsers.length; i++) {
    const user = createdUsers[i];
    const userInterests = sampleUsers[i].interests;

    for (const interestName of userInterests) {
      const interest = createdInterests.find((int) => int.name === interestName);
      if (interest) {
        await prisma.userInterest.create({
          data: {
            user_id: user.id,
            interest_id: interest.id,
          },
        });
        interestCount++;
      }
    }
  }
  console.log(`✅ Created ${interestCount} user-interest relationships\n`);

  // 4. Seed Follows
  console.log('🔗 Creating follow relationships...');
  let followCount = 0;
  for (let i = 0; i < createdUsers.length; i++) {
    const follower = createdUsers[i];
    const numToFollow = Math.floor(Math.random() * 3) + 3;
    const usersToFollow = createdUsers
      .filter((u) => u.id !== follower.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, numToFollow);

    for (const following of usersToFollow) {
      try {
        await prisma.follow.create({
          data: {
            followerId: follower.id,
            followingId: following.id,
          },
        });
        followCount++;
      } catch (error) {
        // Skip duplicates
      }
    }
  }
  console.log(`✅ Created ${followCount} follow relationships\n`);

  // 5. Seed Hashtags
  console.log('#️⃣ Seeding hashtags...');
  const createdHashtags: CreatedHashtag[] = [];
  for (const tag of hashtags) {
    const hashtag = await prisma.hashtag.create({
      data: { tag },
    });
    createdHashtags.push(hashtag);
  }
  console.log(`✅ Created ${createdHashtags.length} hashtags\n`);

  // 6. Seed Posts
  console.log('📝 Seeding posts...');
  const createdPosts: CreatedPost[] = [];
  for (let i = 0; i < 40; i++) {
    const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
    const randomContent = samplePosts[Math.floor(Math.random() * samplePosts.length)];
    const randomDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    const post = await prisma.post.create({
      data: {
        user_id: randomUser.id,
        content: randomContent.content,
        type: randomContent.type,
        visibility: randomContent.visibility,
        created_at: randomDate,
      },
    });

    createdPosts.push(post);

    if (Math.random() > 0.5) {
      const numHashtags = Math.floor(Math.random() * 3) + 1;
      const postHashtags = createdHashtags.sort(() => Math.random() - 0.5).slice(0, numHashtags);

      await prisma.post.update({
        where: { id: post.id },
        data: {
          hashtags: {
            connect: postHashtags.map((h) => ({ id: h.id })),
          },
        },
      });
    }
  }
  console.log(`✅ Created ${createdPosts.length} posts\n`);

  // 7. Seed Replies
  console.log('💬 Seeding replies...');
  const replies = [
    'Great post! This is really interesting 👍',
    'I totally agree with this!',
    'Thanks for sharing! 🙌',
    'This is so helpful, appreciate it!',
    'Amazing content as always! 🔥',
    "Couldn't have said it better myself!",
    'This made my day! 😊',
    'Absolutely love this! ❤️',
    'Thanks for the inspiration!',
    'This is exactly what I needed to hear!',
  ];

  let replyCount = 0;
  for (let i = 0; i < 25; i++) {
    const randomPost = createdPosts[Math.floor(Math.random() * createdPosts.length)];
    const eligibleUsers = createdUsers.filter((u) => u.id !== randomPost.user_id);
    if (eligibleUsers.length === 0) continue;

    const randomUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];

    await prisma.post.create({
      data: {
        user_id: randomUser.id,
        content: randomReply,
        type: PostType.REPLY,
        parent_id: randomPost.id,
        visibility: PostVisibility.EVERY_ONE,
        created_at: new Date(randomPost.created_at.getTime() + Math.random() * 24 * 60 * 60 * 1000),
      },
    });
    replyCount++;
  }
  console.log(`✅ Created ${replyCount} replies\n`);

  // 8. Seed Likes
  console.log('❤️ Seeding likes...');
  let likeCount = 0;
  for (const post of createdPosts) {
    const numLikes = Math.floor(Math.random() * 9) + 2;
    const usersWhoLike = createdUsers
      .filter((u) => u.id !== post.user_id)
      .sort(() => Math.random() - 0.5)
      .slice(0, numLikes);

    for (const user of usersWhoLike) {
      try {
        await prisma.like.create({
          data: {
            post_id: post.id,
            user_id: user.id,
          },
        });
        likeCount++;
      } catch (error) {
        // Skip duplicates
      }
    }
  }
  console.log(`✅ Created ${likeCount} likes\n`);

  // 9. Seed Reposts
  console.log('🔄 Seeding reposts...');
  let repostCount = 0;
  for (let i = 0; i < 20; i++) {
    const randomPost = createdPosts[Math.floor(Math.random() * createdPosts.length)];
    const eligibleUsers = createdUsers.filter((u) => u.id !== randomPost.user_id);
    if (eligibleUsers.length === 0) continue;

    const randomUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];

    try {
      await prisma.repost.create({
        data: {
          post_id: randomPost.id,
          user_id: randomUser.id,
        },
      });
      repostCount++;
    } catch (error) {
      // Skip duplicates
    }
  }
  console.log(`✅ Created ${repostCount} reposts\n`);

  // 10. Seed Media
  console.log('🖼️ Seeding media...');
  let mediaCount = 0;
  for (let i = 0; i < 15; i++) {
    const randomPost = createdPosts[Math.floor(Math.random() * createdPosts.length)];
    const mediaType = Math.random() > 0.6 ? MediaType.IMAGE : MediaType.VIDEO;

    await prisma.media.create({
      data: {
        post_id: randomPost.id,
        media_url:
          mediaType === MediaType.IMAGE
            ? `https://picsum.photos/800/600?random=${i}`
            : `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
        type: mediaType,
      },
    });
    mediaCount++;
  }
  console.log(`✅ Created ${mediaCount} media items\n`);

  // 11. Seed Conversations
  console.log('💬 Seeding conversations...');
  const conversations: CreatedConversation[] = [];
  for (let i = 0; i < 7; i++) {
    const user1Index = i;
    const user2Index = (i + 1) % createdUsers.length;

    const conversation = await prisma.conversation.create({
      data: {
        user1Id: createdUsers[user1Index].id,
        user2Id: createdUsers[user2Index].id,
      },
    });
    conversations.push(conversation);
  }
  console.log(`✅ Created ${conversations.length} conversations\n`);

  // 12. Seed Messages
  console.log('✉️ Seeding messages...');
  const messageTemplates = [
    'Hey! How are you doing?',
    'Did you see the latest update?',
    'Thanks for your help yesterday!',
    'We should catch up sometime!',
    'That was an awesome post you shared!',
    "Let me know when you're free",
    "Hope you're having a great day! 😊",
    'Check out this link I found',
    'What do you think about this?',
    "Can't wait to see you!",
  ];

  let messageCount = 0;
  for (const conversation of conversations) {
    const numMessages = Math.floor(Math.random() * 6) + 4;

    for (let i = 0; i < numMessages; i++) {
      const sender = i % 2 === 0 ? conversation.user1Id : conversation.user2Id;
      const messageText = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: sender,
          text: messageText,
          isSeen: Math.random() > 0.4,
          createdAt: new Date(Date.now() - (numMessages - i) * 60 * 60 * 1000),
        },
      });
      messageCount++;
    }
  }
  console.log(`✅ Created ${messageCount} messages\n`);

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('🎉 Seeding completed successfully!\n');
  console.log('📊 Summary:');
  console.log('═══════════════════════════════════════');
  console.log(`   • Interests:        ${createdInterests.length}`);
  console.log(`   • Users:            ${createdUsers.length}`);
  console.log(`   • User Interests:   ${interestCount}`);
  console.log(`   • Follows:          ${followCount}`);
  console.log(`   • Hashtags:         ${createdHashtags.length}`);
  console.log(`   • Posts:            ${createdPosts.length}`);
  console.log(`   • Replies:          ${replyCount}`);
  console.log(`   • Likes:            ${likeCount}`);
  console.log(`   • Reposts:          ${repostCount}`);
  console.log(`   • Media:            ${mediaCount}`);
  console.log(`   • Conversations:    ${conversations.length}`);
  console.log(`   • Messages:         ${messageCount}`);
  console.log('═══════════════════════════════════════\n');
  console.log('✨ Your database is ready to use!\n');
  console.log('📝 Login Credentials:');
  console.log('═══════════════════════════════════════');
  console.log('👑 ADMIN Account:');
  console.log('   Email:    mohamed-sameh-albaz@example.com');
  console.log('   Username: mohamed-sameh-albaz');
  console.log('   Password: Password123!');
  console.log('');
  console.log('👤 Sample User Accounts:');
  console.log('   Email:    john.doe@example.com');
  console.log('   Username: john_doe');
  console.log('   Password: Password123!');
  console.log('');
  console.log('   (All users have the same password)');
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
