-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "scope" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "sportDetail" TEXT,
    "startTime" DATETIME NOT NULL,
    "timezone" TEXT,
    "durationSec" INTEGER NOT NULL,
    "movingSec" INTEGER,
    "distanceM" REAL NOT NULL DEFAULT 0,
    "elevGainM" REAL,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "avgSpeedMs" REAL,
    "calories" INTEGER,
    "hasGps" BOOLEAN NOT NULL DEFAULT false,
    "polyline" TEXT,
    "streamsJson" TEXT,
    "rawJson" TEXT,
    "duplicateOfId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivitySplit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "distanceM" REAL NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "movingSec" INTEGER,
    "avgSpeedMs" REAL,
    "avgHr" INTEGER,
    "elevDiffM" REAL,
    CONSTRAINT "ActivitySplit_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "distanceM" REAL NOT NULL,
    "raceType" TEXT NOT NULL,
    "goalSec" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Race_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueSec" INTEGER,
    "valueM" REAL,
    "valueNum" REAL,
    "activityId" TEXT,
    "achievedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "sport" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "distanceM" REAL NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "longestM" REAL NOT NULL DEFAULT 0,
    "avgHr" REAL,
    "avgSpeedMs" REAL,
    CONSTRAINT "WeeklyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_userId_provider_key" ON "ConnectedAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "Activity_userId_startTime_idx" ON "Activity"("userId", "startTime");

-- CreateIndex
CREATE INDEX "Activity_userId_sport_startTime_idx" ON "Activity"("userId", "sport", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_source_externalId_key" ON "Activity"("source", "externalId");

-- CreateIndex
CREATE INDEX "ActivitySplit_activityId_idx" ON "ActivitySplit"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_userId_category_key" ON "PersonalRecord"("userId", "category");

-- CreateIndex
CREATE INDEX "WeeklyMetric_userId_sport_weekStart_idx" ON "WeeklyMetric"("userId", "sport", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMetric_userId_weekStart_sport_key" ON "WeeklyMetric"("userId", "weekStart", "sport");
