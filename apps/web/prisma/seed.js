const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const reset = async () => {
  await prisma.user.deleteMany();
  await prisma.message.deleteMany();
};

const main = async () => {
  console.log('resetting db...');
  await reset();

  console.log('seeding...');
  const sender = await prisma.user.create({
    data: { password: 'sender', username: 'sender' },
  });
  const receiver = await prisma.user.create({
    data: { password: 'receiver', username: 'receiver' },
  });

  const message = await prisma.message.create({
    data: {
      content: 'test message',
      /**
       * OR use username to connect
       * sender: { connect: { username: sender.username } },
       * receiver : { connect: { username: receiver.username } },
       */
      senderId: sender.id,
      receiverId: receiver.id,
    },
  });

  console.log(
    `${sender.username} sent "${message.content}" to ${receiver.username}`
  );
};

// eslint-disable-next-line no-console
main().catch(console.error);
