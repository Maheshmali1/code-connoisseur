/**
 * A simple user management module
 */

/**
 * User interface
 */
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  active: boolean;
}

/**
 * Class to manage users
 */
class UserManager {
  private users: User[] = [];

  /**
   * Add a new user
   * @param user - User object to add
   * @returns The added user with ID
   */
  addUser(user: Omit<User, 'id'>): User {
    const newUser: User = {
      ...user,
      id: this.generateId()
    };
    this.users.push(newUser);
    return newUser;
  }

  /**
   * Get a user by ID
   * @param id - User ID
   * @returns User object or undefined if not found
   */
  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  /**
   * Update a user
   * @param id - User ID
   * @param userData - User data to update
   * @returns Updated user or undefined if not found
   */
  updateUser(id: number, userData: Partial<Omit<User, 'id'>>): User | undefined {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return undefined;

    this.users[index] = {
      ...this.users[index],
      ...userData
    };

    return this.users[index];
  }

  /**
   * Delete a user
   * @param id - User ID
   * @returns True if user was deleted, false otherwise
   */
  deleteUser(id: number): boolean {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return false;

    this.users.splice(index, 1);
    return true;
  }

  /**
   * Get all users
   * @returns Array of all users
   */
  getAllUsers(): User[] {
    return [...this.users];
  }

  /**
   * Generate a unique ID
   * @returns New unique ID
   * @private
   */
  private generateId(): number {
    return this.users.length > 0
      ? Math.max(...this.users.map(user => user.id)) + 1
      : 1;
  }
}

export { User, UserManager };