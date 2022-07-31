-- CreateIndex
CREATE INDEX `Message_receiverId_createdAt_idx` ON `Message`(`receiverId`, `createdAt` DESC);

-- CreateIndex
CREATE INDEX `User_username_idx` ON `User`(`username`);
