import { prisma } from './db'

/** Single-user app: return the one user, creating a default if needed. */
export async function getCurrentUser() {
  let user = await prisma.user.findFirst()
  if (!user) {
    user = await prisma.user.create({ data: { name: 'Alex' } })
  }
  return user
}
