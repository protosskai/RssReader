/**
 * Dependency Injection Container
 * 依赖注入容器 - 统一管理所有依赖
 */

import {
  ArticleRepository,
  FeedRepository,
  FolderRepository,
  RepositoryFactory
} from '../domain/repositories/Interfaces';

import { ArticleService } from '../domain/services/ArticleService';
import {
  SqliteArticleRepository,
  SqliteFeedRepository,
  SqliteFolderRepository,
  SqliteRepositoryFactory
} from './repositories/ArticleRepositoryImpl';

class DIContainer {
  private repositories: Map<string, any> = new Map();
  private services: Map<string, any> = new Map();
  private factory: RepositoryFactory;

  constructor() {
    this.factory = new SqliteRepositoryFactory();
    this.initializeRepositories();
    this.initializeServices();
  }

  private initializeRepositories() {
    this.repositories.set('articleRepo', this.factory.createArticleRepository());
    this.repositories.set('feedRepo', this.factory.createFeedRepository());
    this.repositories.set('folderRepo', this.factory.createFolderRepository());
  }

  private initializeServices() {
    const articleRepo = this.get<ArticleRepository>('articleRepo');
    const feedRepo = this.get<FeedRepository>('feedRepo');
    const folderRepo = this.get<FolderRepository>('folderRepo');

    this.services.set('articleService', new ArticleService(articleRepo, feedRepo, folderRepo));
  }

  get<T>(key: string): T {
    if (this.repositories.has(key)) {
      return this.repositories.get(key);
    }
    if (this.services.has(key)) {
      return this.services.get(key);
    }
    throw new Error(`Dependency not found: ${key}`);
  }

  getRepository<K extends keyof RepositoryFactory>(name: K): ReturnType<RepositoryFactory[K]> {
    return this.get<ReturnType<RepositoryFactory[K]>>(name.replace('create', '').toLowerCase() + 'Repo');
  }

  getService<K extends keyof ArticleService>(name: K): ArticleService {
    return this.get<ArticleService>('articleService');
  }
}

// Singleton instance
let containerInstance: DIContainer | null = null;

export function getContainer(): DIContainer {
  if (!containerInstance) {
    containerInstance = new DIContainer();
  }
  return containerInstance;
}

// Convenience functions for getting dependencies
export function getArticleService(): ArticleService {
  return getContainer().getService('articleService');
}

export function getArticleRepository(): ArticleRepository {
  return getContainer().get<ArticleRepository>('articleRepo');
}

export function getFeedRepository(): FeedRepository {
  return getContainer().get<FeedRepository>('feedRepo');
}

export function getFolderRepository(): FolderRepository {
  return getContainer().get<FolderRepository>('folderRepo');
}
