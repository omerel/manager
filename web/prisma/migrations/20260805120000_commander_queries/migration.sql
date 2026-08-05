-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "senderNodeId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueChangedAt" TIMESTAMP(3),

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryTarget" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "answer" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "mailOk" BOOLEAN,
    "mailError" TEXT,

    CONSTRAINT "QueryTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueryTarget_queryId_nodeId_key" ON "QueryTarget"("queryId", "nodeId");

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_senderNodeId_fkey" FOREIGN KEY ("senderNodeId") REFERENCES "OrgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryTarget" ADD CONSTRAINT "QueryTarget_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryTarget" ADD CONSTRAINT "QueryTarget_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "OrgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryTarget" ADD CONSTRAINT "QueryTarget_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

