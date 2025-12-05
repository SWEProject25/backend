import { PrismaClient, Role, PostType, PostVisibility, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data (in reverse order of dependencies)
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.media.deleteMany();
  await prisma.mention.deleteMany();
  await prisma.like.deleteMany();
  await prisma.repost.deleteMany();
  await prisma.mute.deleteMany();
  await prisma.block.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.post.deleteMany();
  await prisma.userInterest.deleteMany();
  await prisma.interest.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create interests
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
    {
      name: 'Celebrity',
      slug: 'celebrity',
      icon: '⭐',
      description: 'Keep up with celebrity news',
    },
    {
      name: 'Relationships',
      slug: 'relationships',
      icon: '❤️',
      description: 'Dating, love, and relationship advice',
    },
    { name: 'Movies & TV', slug: 'movies-tv', icon: '🎬', description: 'Latest in entertainment' },
    {
      name: 'Technology',
      slug: 'technology',
      icon: '💻',
      description: 'Tech news and innovations',
    },
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

  const createdInterests: any[] = [];
  for (const interest of interests) {
    const created = await prisma.interest.create({
      data: interest,
    });
    createdInterests.push(created);
  }
  console.log(`Created ${createdInterests.length} interests`);

  // Create users
  const users = [
    {
      email: 'karimzakzouk69@gmail.com',
      username: 'karimzakzouk',
      password: '',
      is_verified: true,
      provider_id: '147805022',
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-16T01:52:52.169Z'),
      updated_at: new Date('2025-11-16T01:52:52.169Z'),
    },
    {
      email: 'mazenfarid201269@gmail.com',
      username: 'farid.ka2886',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$eqOf3z4CvT7Uj2PsFhQHyw$w6rgy0z1xS0PI+WUNiOGReDB14Mi3BYNnEnaPTw13nA',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-16T01:59:20.204Z'),
      updated_at: new Date('2025-11-16T01:59:20.204Z'),
    },
    {
      email: 'gptchat851@gmail.com',
      username: 'gpt.ch8701',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$gX7JG4G4zjbsjZdNMA8eRw$XRWmuWiKVBdrODQdIAq6LK5t62o8Y2tjKfAHHgbLTVs',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-16T02:03:31.079Z'),
      updated_at: new Date('2025-11-16T02:03:31.079Z'),
    },
    {
      email: 'karimzakzouk@outlook.com',
      username: 'karim.ka104',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$BxarIYgdOoTbwEhoP064rg$+N+5lyqTYe8kf2Q0SjrRq+D/RpU7Nm4uxTY6kg+w4WY',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-16T03:12:02.576Z'),
      updated_at: new Date('2025-11-16T03:12:02.576Z'),
    },
    {
      email: 'mazenrory@gmail.com',
      username: 'mazen.ma4904',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$w9Th/ppqgNZHVEHJNI4xbw$tR1U2C0dFM5/uuy+V5vskG8ZS4dIGGpQMkimmPZx9YA',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-16T13:00:40.899Z'),
      updated_at: new Date('2025-11-16T13:00:40.899Z'),
    },
    {
      email: 'ahmedfathi20044002@gmail.com',
      username: 'fathi.ah8581',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$a5xKn9FMFGiSf6uEcuHREQ$Axs6vlPAZfa6qv+ZL6IU2R3p73fF7JtwlKLXrklRvkc',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-17T15:25:11.012Z'),
      updated_at: new Date('2025-11-17T15:25:11.012Z'),
    },
    {
      email: 'ahmedfathy20044002@gmail.com',
      username: 'fathy.ah2669',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$W5EntXTQGO3sJBiJPOVyoA$jHbxWH5b78+AplvP24Pjt8lz1GSEuva11qzUHe6mNdQ',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-17T15:25:25.406Z'),
      updated_at: new Date('2025-11-17T15:25:25.406Z'),
    },
    {
      email: 'engba80818233@gmail.com',
      username: 'adel.ab1295',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$+DkFmIawOeN10PqpCNwIyQ$68EfLW+tByPPmksZ1qFxUzSCOQxM1znR/0+7GrVGIuw',
      is_verified: true,
      provider_id: '149705123',
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-17T15:34:12.790Z'),
      updated_at: new Date('2025-11-18T10:59:47.748Z'),
    },
    {
      email: 'warframe200469@gmail.com',
      username: 'karim.ka169',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$4WcLnsm0Qj2L3nCDNYciYw$9spTbEH3KC9gYC69YRwDeHlQbSzYYOFL/iGHKqmt5Dc',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-17T15:47:03.278Z'),
      updated_at: new Date('2025-11-17T15:47:03.278Z'),
    },
    {
      email: 'hankers67@outlook.com',
      username: 'karim.ka2562',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$vR3Xm9v/41JrLJlLgkoJWw$OnDT9XlOzzKNDnPVg/YkCPnyS7C1dVLG5liZlpWzW58',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-17T15:56:54.207Z'),
      updated_at: new Date('2025-11-17T15:56:54.207Z'),
    },
    {
      email: 'Mohamedalbaz492@gmail.com',
      username: 'mohamed-sameh-albaz',
      password: '',
      is_verified: true,
      provider_id: '136837275',
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-18T07:27:54.594Z'),
      updated_at: new Date('2025-11-18T07:27:54.594Z'),
    },
    {
      email: 'ahmedg.ellabban339@gmail.com',
      username: 'ryuzaki',
      password: '$argon2i$v=19$m=16,t=2,p=1$TmU1RDJrczRuTktraXVwYg$DPll4hwvRTv+omTCo2SpFA',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-18T11:12:23.516Z'),
      updated_at: new Date('2025-11-18T11:12:23.516Z'),
    },
    {
      email: 'Ahmed.ellabban04@eng-st.cu.edu.eg',
      username: 'ahmedGamalEllabban',
      password: '',
      is_verified: true,
      provider_id: '138603828',
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-18T16:16:11.820Z'),
      updated_at: new Date('2025-11-18T16:16:11.820Z'),
    },
    {
      email: 'omarnabil219@gmail.com',
      username: 'nabil.om3149',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$A1zdLDjpMKgZ0s3gSpw1dg$hadZhQaEWU0D4dkieAq0hbzMLD0/TzCi09cCQdEeRuI',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-18T17:21:31.209Z'),
      updated_at: new Date('2025-11-18T17:21:31.209Z'),
    },
    {
      email: 'farouk.hussien03@eng-st.cu.edu.eg',
      username: 'far.fa3409',
      password:
        '$argon2id$v=19$m=65536,t=3,p=4$F40HohKInxmct90G/CCZDg$vgtW+srJhZUXY1lOf/UmRP2mAaWm3QcTq/uYJVTqxQ8',
      is_verified: true,
      provider_id: null,
      role: Role.USER,
      has_completed_interests: true,
      has_completed_following: true,
      created_at: new Date('2025-11-18T21:14:57.000Z'),
      updated_at: new Date('2025-11-18T21:14:57.000Z'),
    },
  ];

  const createdUsers: any[] = [];
  for (const user of users) {
    const created = await prisma.user.create({
      data: user,
    });
    createdUsers.push(created);
  }
  console.log(`Created ${createdUsers.length} users`);

  // Create profiles for users
  const profiles = [
    {
      user_id: createdUsers[0].id, // karimzakzouk
      name: 'Karim Zakzouk',
      birth_date: new Date('1995-03-15'),
      bio: '🚀 Tech enthusiast | Full-stack developer | Coffee addict ☕',
      location: 'Cairo, Egypt',
      website: 'https://karimzakzouk.dev',
    },
    {
      user_id: createdUsers[1].id, // farid.ka2886
      name: 'Mazen Farid',
      birth_date: new Date('1998-07-22'),
      bio: '💻 Software Engineer | Gaming enthusiast 🎮',
      location: 'Alexandria, Egypt',
      website: null,
    },
    {
      user_id: createdUsers[2].id, // gpt.ch8701
      name: 'GPT Chat',
      birth_date: new Date('2000-01-01'),
      bio: '🤖 AI exploring the human world | Tech & Innovation',
      location: 'Cyberspace',
      website: 'https://openai.com',
    },
    {
      user_id: createdUsers[3].id, // karim.ka104
      name: 'Karim K.',
      birth_date: new Date('1996-11-08'),
      bio: '📸 Photography | Travel blogger ✈️',
      location: 'Dubai, UAE',
      website: 'https://karimtravels.com',
    },
    {
      user_id: createdUsers[4].id, // mazen.ma4904
      name: 'Mazen Rory',
      birth_date: new Date('1997-05-12'),
      bio: '🏋️ Fitness coach | Nutrition expert | Living healthy',
      location: 'Giza, Egypt',
      website: 'https://fitwithmazen.com',
    },
    {
      user_id: createdUsers[5].id, // fathi.ah8581
      name: 'Ahmed Fathi',
      birth_date: new Date('1999-09-30'),
      bio: '🎵 Music producer | Sound designer',
      location: 'Cairo, Egypt',
      website: null,
    },
    {
      user_id: createdUsers[6].id, // fathy.ah2669
      name: 'Ahmed Fathy',
      birth_date: new Date('1999-02-14'),
      bio: '🎬 Filmmaker | Content creator',
      location: 'Cairo, Egypt',
      website: 'https://fathyfilms.com',
    },
    {
      user_id: createdUsers[7].id, // adel.ab1295
      name: 'Abdelrahman Adel',
      birth_date: new Date('1998-06-20'),
      bio: '⚽ Sports enthusiast | Football fan | Manchester United supporter',
      location: 'Cairo, Egypt',
      website: null,
    },
    {
      user_id: createdUsers[8].id, // karim.ka169
      name: 'Karim Warframe',
      birth_date: new Date('1997-12-05'),
      bio: '🎮 Pro gamer | Streamer | Warframe expert',
      location: 'Cairo, Egypt',
      website: 'https://twitch.tv/karimwar',
    },
    {
      user_id: createdUsers[9].id, // karim.ka2562
      name: 'Hankers',
      birth_date: new Date('2001-04-18'),
      bio: '🎨 Digital artist | NFT creator',
      location: 'London, UK',
      website: 'https://hankers.art',
    },
    {
      user_id: createdUsers[10].id, // mohamed-sameh-albaz
      name: 'Mohamed Sameh Albaz',
      birth_date: new Date('1996-08-25'),
      bio: '👨‍💻 Full-stack developer | Open source contributor | Tech blogger',
      location: 'Cairo, Egypt',
      website: 'https://github.com/mohamed-sameh-albaz',
    },
    {
      user_id: createdUsers[11].id, // ryuzaki
      name: 'Ryuzaki',
      birth_date: new Date('1998-10-31'),
      bio: "🕵️ World's greatest detective | Sweets lover 🍰",
      location: 'Undisclosed',
      website: null,
    },
    {
      user_id: createdUsers[12].id, // ahmedGamalEllabban
      name: 'Ahmed Gamal Ellabban',
      birth_date: new Date('1999-03-07'),
      bio: '💼 Business analyst | Data enthusiast 📊',
      location: 'Cairo, Egypt',
      website: 'https://github.com/ahmedGamalEllabban',
    },
    {
      user_id: createdUsers[13].id, // nabil.om3149
      name: 'Omar Nabil',
      birth_date: new Date('2000-07-15'),
      bio: '🏗️ Civil engineer | Architecture lover',
      location: 'Cairo, Egypt',
      website: null,
    },
    {
      user_id: createdUsers[14].id, // far.fa3409
      name: 'Farouk Hussein',
      birth_date: new Date('1997-01-28'),
      bio: '🔬 Research scientist | AI researcher',
      location: 'Cairo, Egypt',
      website: 'https://farouk-research.com',
    },
  ];

  for (const profile of profiles) {
    await prisma.profile.create({
      data: profile,
    });
  }
  console.log(`Created ${profiles.length} profiles`);

  // Assign random interests to users
  const userInterestData: Array<{ user_id: number; interest_id: number }> = [];
  for (const user of createdUsers) {
    // Each user gets 3-6 random interests
    const numInterests = Math.floor(Math.random() * 4) + 3;
    const shuffled = [...createdInterests].sort(() => 0.5 - Math.random());
    const selectedInterests = shuffled.slice(0, numInterests);

    for (const interest of selectedInterests) {
      userInterestData.push({
        user_id: user.id,
        interest_id: interest.id,
      });
    }
  }

  for (const userInterest of userInterestData) {
    await prisma.userInterest.create({
      data: userInterest,
    });
  }
  console.log(`Created ${userInterestData.length} user interests`);

  // Create follow relationships
  const follows = [
    // User 10 (mohamed-sameh-albaz) follows several users
    { followerId: createdUsers[10].id, followingId: createdUsers[0].id },
    { followerId: createdUsers[10].id, followingId: createdUsers[1].id },
    { followerId: createdUsers[10].id, followingId: createdUsers[11].id },
    { followerId: createdUsers[10].id, followingId: createdUsers[12].id },
    { followerId: createdUsers[10].id, followingId: createdUsers[13].id },

    // Other users follow back
    { followerId: createdUsers[0].id, followingId: createdUsers[10].id },
    { followerId: createdUsers[1].id, followingId: createdUsers[10].id },
    { followerId: createdUsers[11].id, followingId: createdUsers[10].id },
    { followerId: createdUsers[12].id, followingId: createdUsers[10].id },

    // Cross follows
    { followerId: createdUsers[0].id, followingId: createdUsers[1].id },
    { followerId: createdUsers[1].id, followingId: createdUsers[0].id },
    { followerId: createdUsers[2].id, followingId: createdUsers[0].id },
    { followerId: createdUsers[3].id, followingId: createdUsers[2].id },
    { followerId: createdUsers[4].id, followingId: createdUsers[3].id },
    { followerId: createdUsers[5].id, followingId: createdUsers[4].id },
    { followerId: createdUsers[6].id, followingId: createdUsers[5].id },
    { followerId: createdUsers[7].id, followingId: createdUsers[6].id },
    { followerId: createdUsers[8].id, followingId: createdUsers[7].id },
    { followerId: createdUsers[9].id, followingId: createdUsers[8].id },
    { followerId: createdUsers[11].id, followingId: createdUsers[12].id },
    { followerId: createdUsers[12].id, followingId: createdUsers[11].id },
    { followerId: createdUsers[13].id, followingId: createdUsers[14].id },
    { followerId: createdUsers[14].id, followingId: createdUsers[13].id },
  ];

  for (const follow of follows) {
    await prisma.follow.create({
      data: follow,
    });
  }
  console.log(`Created ${follows.length} follow relationships`);

  const hashtags = [
    'technology',
    'coding',
    'javascript',
    'typescript',
    'nodejs',
    'react',
    'webdev',
    'programming',
    'ai',
    'machinelearning',
    'fitness',
    'travel',
    'photography',
    'gaming',
    'esports',
    'music',
    'art',
    'design',
    'food',
    'health',
  ];

  const createdHashtags: any[] = [];
  for (const tag of hashtags) {
    const created = await prisma.hashtag.create({
      data: { tag: `#${tag}` },
    });
    createdHashtags.push(created);
  }
  console.log(`✅ Created ${createdHashtags.length} hashtags`);

  // Create posts
  const posts = [
    {
      user_id: createdUsers[10].id, // mohamed-sameh-albaz
      content:
        'Just deployed my new social media platform! 🚀 Excited to see everyone using it. #webdev #typescript #nodejs',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T10:00:00Z'),
    },
    {
      user_id: createdUsers[0].id, // karimzakzouk
      content:
        'Working on a new feature for authentication. OAuth2 is fascinating! 🔐 #coding #security',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T11:30:00Z'),
    },
    {
      user_id: createdUsers[1].id, // farid.ka2886
      content:
        'Just finished a 10-hour gaming session. My eyes hurt but it was worth it! 😅 #gaming #esports',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T14:00:00Z'),
    },
    {
      user_id: createdUsers[2].id, // gpt.ch8701
      content:
        'AI is evolving faster than ever. The future is here! 🤖 #ai #machinelearning #technology',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T09:00:00Z'),
    },
    {
      user_id: createdUsers[3].id, // karim.ka104
      content: 'Captured the most beautiful sunset in Dubai today! 🌅 #photography #travel',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T18:00:00Z'),
    },
    {
      user_id: createdUsers[4].id, // mazen.ma4904
      content: 'Morning workout done! Remember: consistency is key 💪 #fitness #health',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T06:00:00Z'),
    },
    {
      user_id: createdUsers[5].id, // fathi.ah8581
      content: 'New track dropping this Friday! Stay tuned 🎵 #music',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T15:00:00Z'),
    },
    {
      user_id: createdUsers[11].id, // ryuzaki
      content: 'The cake is a lie, but this detective work is not 🍰🕵️',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T20:00:00Z'),
    },
    {
      user_id: createdUsers[12].id, // ahmedGamalEllabban
      content: 'Data analysis reveals interesting patterns in user behavior 📊 #data #analytics',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T13:00:00Z'),
    },
    {
      user_id: createdUsers[13].id, // nabil.om3149
      content: 'Architecture is frozen music 🏛️ #architecture #design',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T16:00:00Z'),
    },
    {
      user_id: createdUsers[14].id, // far.fa3409
      content:
        'Published my latest research paper on neural networks! Link in bio 🔬 #ai #research',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T12:00:00Z'),
    },
    {
      user_id: createdUsers[7].id, // adel.ab1295
      content: 'Manchester United won! What a match! ⚽🔴 #football #MUFC',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T21:00:00Z'),
    },
    {
      user_id: createdUsers[8].id, // karim.ka169
      content: 'Streaming live in 10 minutes! Come watch some Warframe action 🎮 #gaming #twitch',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T19:00:00Z'),
    },
    {
      user_id: createdUsers[9].id, // karim.ka2562
      content: 'Just minted my new NFT collection! Check it out 🎨 #art #nft #crypto',
      type: PostType.POST,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T17:00:00Z'),
    },
  ];

  const createdPosts: any[] = [];
  for (const post of posts) {
    const created = await prisma.post.create({
      data: post,
    });
    createdPosts.push(created);
  }
  console.log(`Created ${createdPosts.length} posts`);

  // Create replies to posts
  const replies = [
    {
      user_id: createdUsers[0].id, // karimzakzouk
      content: 'Congratulations! Looking forward to exploring it! 🎉',
      type: PostType.REPLY,
      parent_id: createdPosts[0].id,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T10:15:00Z'),
    },
    {
      user_id: createdUsers[11].id, // ryuzaki
      content: 'Great work! The authentication flow is smooth 👍',
      type: PostType.REPLY,
      parent_id: createdPosts[0].id,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T10:30:00Z'),
    },
    {
      user_id: createdUsers[10].id, // mohamed-sameh-albaz
      content: 'Thanks! Let me know if you find any bugs 🐛',
      type: PostType.REPLY,
      parent_id: createdPosts[0].id,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T10:45:00Z'),
    },
    {
      user_id: createdUsers[1].id, // farid.ka2886
      content: 'Which game? 🎮',
      type: PostType.REPLY,
      parent_id: createdPosts[2].id,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T14:15:00Z'),
    },
  ];

  for (const reply of replies) {
    await prisma.post.create({
      data: reply,
    });
  }
  console.log(`Created ${replies.length} replies`);

  // Create quote posts
  const quotes = [
    {
      user_id: createdUsers[12].id, // ahmedGamalEllabban
      content: 'This is exactly what we needed! Amazing work 👏',
      type: PostType.QUOTE,
      parent_id: createdPosts[0].id,
      visibility: PostVisibility.EVERY_ONE,
      created_at: new Date('2025-11-20T11:00:00Z'),
    },
  ];

  for (const quote of quotes) {
    await prisma.post.create({
      data: quote,
    });
  }
  console.log(`Created ${quotes.length} quote posts`);

  // Connect posts to hashtags
  await prisma.post.update({
    where: { id: createdPosts[0].id },
    data: {
      hashtags: {
        connect: [{ tag: '#webdev' }, { tag: '#typescript' }, { tag: '#nodejs' }],
      },
    },
  });

  await prisma.post.update({
    where: { id: createdPosts[1].id },
    data: {
      hashtags: {
        connect: [{ tag: '#coding' }],
      },
    },
  });

  await prisma.post.update({
    where: { id: createdPosts[2].id },
    data: {
      hashtags: {
        connect: [{ tag: '#gaming' }, { tag: '#esports' }],
      },
    },
  });

  console.log('Connected posts to hashtags');

  // Create likes
  const likes = [
    { post_id: createdPosts[0].id, user_id: createdUsers[0].id },
    { post_id: createdPosts[0].id, user_id: createdUsers[1].id },
    { post_id: createdPosts[0].id, user_id: createdUsers[11].id },
    { post_id: createdPosts[0].id, user_id: createdUsers[12].id },
    { post_id: createdPosts[0].id, user_id: createdUsers[13].id },
    { post_id: createdPosts[1].id, user_id: createdUsers[10].id },
    { post_id: createdPosts[1].id, user_id: createdUsers[1].id },
    { post_id: createdPosts[2].id, user_id: createdUsers[8].id },
    { post_id: createdPosts[3].id, user_id: createdUsers[10].id },
    { post_id: createdPosts[3].id, user_id: createdUsers[14].id },
    { post_id: createdPosts[4].id, user_id: createdUsers[9].id },
    { post_id: createdPosts[5].id, user_id: createdUsers[4].id },
    { post_id: createdPosts[6].id, user_id: createdUsers[5].id },
  ];

  for (const like of likes) {
    await prisma.like.create({
      data: like,
    });
  }
  console.log(`Created ${likes.length} likes`);

  // Create reposts
  const reposts = [
    { post_id: createdPosts[0].id, user_id: createdUsers[11].id },
    { post_id: createdPosts[0].id, user_id: createdUsers[12].id },
    { post_id: createdPosts[3].id, user_id: createdUsers[14].id },
  ];

  for (const repost of reposts) {
    await prisma.repost.create({
      data: repost,
    });
  }
  console.log(`Created ${reposts.length} reposts`);

  // Create some media for posts
  const media = [
    {
      post_id: createdPosts[4].id, // Photography post
      media_url:
        'https://fastly.picsum.photos/id/413/800/600.jpg?hmac=VEaKKcAaCdhHoKRA0lKgXJxwgrLYJnLeI-6sc_9ExBM',
      type: MediaType.IMAGE,
    },
    {
      post_id: createdPosts[4].id,
      media_url:
        'https://fastly.picsum.photos/id/356/800/600.jpg?hmac=mqpR-bEfsxbcxdPMKHlvzxoryEFa__KAuFIK7QOSL1c',
      type: MediaType.IMAGE,
    },
    {
      post_id: createdPosts[13].id, // NFT art post
      media_url:
        'https://fastly.picsum.photos/id/842/800/800.jpg?hmac=V0Kdv88qg256F311iJNd5xBn5EWJXP7NUACcMILCy9Q',
      type: MediaType.IMAGE,
    },
  ];

  const mediaWithUserId = media.map((m) => {
    const post = createdPosts.find((p) => p.id === m.post_id);
    if (!post) throw new Error("Post not found for media item");
    return {
      post_id: m.post_id,
      user_id: post.user_id, 
      media_url: m.media_url,
      type: m.type,
    };
  });

  for (const m of mediaWithUserId) {
    await prisma.media.create({
      data: m,
    });
  }
  console.log(`Created ${mediaWithUserId.length} media items`);

  // Create conversations
  const conversations = [
    {
      user1Id: createdUsers[10].id, // mohamed-sameh-albaz
      user2Id: createdUsers[0].id, // karimzakzouk
      nextMessageIndex: 1,
    },
    {
      user1Id: createdUsers[10].id, // mohamed-sameh-albaz
      user2Id: createdUsers[11].id, // ryuzaki
      nextMessageIndex: 1,
    },
    {
      user1Id: createdUsers[0].id, // karimzakzouk
      user2Id: createdUsers[1].id, // farid.ka2886
      nextMessageIndex: 1,
    },
  ];

  const createdConversations: any[] = [];
  for (const conversation of conversations) {
    const created = await prisma.conversation.create({
      data: conversation,
    });
    createdConversations.push(created);
  }
  console.log(`Created ${createdConversations.length} conversations`);

  // Create messages
  const messages = [
    {
      conversationId: createdConversations[0].id,
      messageIndex: 1,
      senderId: createdUsers[10].id, // mohamed-sameh-albaz
      text: 'Hey! How are you?',
      createdAt: new Date('2025-11-20T08:00:00Z'),
    },
    {
      conversationId: createdConversations[0].id,
      messageIndex: 2,
      senderId: createdUsers[0].id, // karimzakzouk
      text: "Hi! I'm good, thanks! Just working on the OAuth implementation.",
      isSeen: true,
      createdAt: new Date('2025-11-20T08:05:00Z'),
    },
    {
      conversationId: createdConversations[0].id,
      messageIndex: 3,
      senderId: createdUsers[10].id, // mohamed-sameh-albaz
      text: 'That sounds interesting! Let me know if you need any help.',
      createdAt: new Date('2025-11-20T08:10:00Z'),
    },
    {
      conversationId: createdConversations[1].id,
      messageIndex: 1,
      senderId: createdUsers[11].id, // ryuzaki
      text: 'The platform looks amazing! Great job! 🎉',
      createdAt: new Date('2025-11-20T10:20:00Z'),
    },
    {
      conversationId: createdConversations[1].id,
      messageIndex: 2,
      senderId: createdUsers[10].id, // mohamed-sameh-albaz
      text: 'Thanks! Your feedback means a lot!',
      isSeen: true,
      createdAt: new Date('2025-11-20T10:25:00Z'),
    },
    {
      conversationId: createdConversations[2].id,
      messageIndex: 1,
      senderId: createdUsers[0].id, // karimzakzouk
      text: 'Want to play some games later?',
      createdAt: new Date('2025-11-20T14:30:00Z'),
    },
    {
      conversationId: createdConversations[2].id,
      messageIndex: 2,
      senderId: createdUsers[1].id, // farid.ka2886
      text: 'Sure! What time?',
      isSeen: true,
      createdAt: new Date('2025-11-20T14:35:00Z'),
    },
  ];

  for (const message of messages) {
    await prisma.message.create({
      data: message,
    });
  }
  console.log(`Created ${messages.length} messages`);

  // Update conversation nextMessageIndex
  await prisma.conversation.update({
    where: { id: createdConversations[0].id },
    data: { nextMessageIndex: 4 },
  });
  await prisma.conversation.update({
    where: { id: createdConversations[1].id },
    data: { nextMessageIndex: 3 },
  });
  await prisma.conversation.update({
    where: { id: createdConversations[2].id },
    data: { nextMessageIndex: 3 },
  });

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
