import { EntityRepository, Repository } from 'typeorm';

import Category from '../models/Category';

interface FindOrCreate {
  title: string;
}

@EntityRepository(Category)
class CategoriesRepository extends Repository<Category> {
  public async findOneByTitleOrCreate({
    title,
  }: FindOrCreate): Promise<Category> {
    let category = await this.findOne({ where: { title } });

    if (!category) {
      category = this.create({ title });
      await this.save(category);
    }

    return category;
  }
}

export default CategoriesRepository;
