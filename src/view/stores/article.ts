/* eslint-disable class-methods-use-this */
import { makeAutoObservable } from 'mobx';
import { getCustomRepository } from 'typeorm';
import { Article, RSSFeedItem } from '../../infra/types';
import { ArticleEntity } from '../../entity/article';
import { ArticleRepository } from '../../repository/article';
import { ArticleReadStatus } from '../../infra/constants/status';

export class ArticleStore {
  unreadAmount: number;

  currentArticle: ArticleEntity = {} as ArticleEntity;

  articleList: ArticleEntity[] = [];

  articleRepo = {} as ArticleRepository;

  constructor() {
    makeAutoObservable(this);

    this.articleRepo = getCustomRepository(ArticleRepository);
  }

  setCurrentArticle(article: ArticleEntity) {
    this.currentArticle = article;
  }

  async getAllList(): Promise<Article[]> {
    return this.articleRepo.getAllArticle();
  }

  async getAllUnread(): Promise<Article[]> {
    return this.articleRepo.getAllUnread();
  }

  async getListWithChannelId(channelId: string): Promise<Article[]> {
    return this.articleRepo.getListWithChannelId(channelId);
  }

  setCurrentView(article: ArticleEntity): void {
    this.currentArticle = article;
  }

  async insertArticles(channelId: string, articles: RSSFeedItem[]) {
    try {
      await this.articleRepo.insertArticles(channelId, articles);
    } catch (err) {
      console.error(err.message);
    }

    return '';
  }

  /**
   * 将文章标记为已读
   * @param id
   */
  async markArticleAsRead(id: string) {
    try {
      return this.articleRepo.update(id, {
        hasRead: ArticleReadStatus.isRead,
      });
    } catch (err) {
      console.error(err.message);
    }

    return '';
  }
}
