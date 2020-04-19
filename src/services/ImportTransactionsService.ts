import { createReadStream, promises } from 'fs';
import csvParse from 'csv-parse';
import { join } from 'path';
import { getRepository, getCustomRepository, In } from 'typeorm';

import Transaction from '../models/Transaction';

import UploadConfig from '../config/multer';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

type TypeRequest = 'income' | 'outcome';

interface Request {
  filename: string;
}

interface TransactionCSV {
  title: string;
  type: TypeRequest;
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ filename }: Request): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);
    const parser = csvParse({ from_line: 2, trim: true });

    const csvFilePath = join(UploadConfig.directory, filename);
    const csvReadStream = createReadStream(csvFilePath);

    const parsedCSV = csvReadStream.pipe(parser);

    const transactions: TransactionCSV[] = [];
    const categories: string[] = [];

    parsedCSV.on('data', async line => {
      const [title, type, value, category] = line;

      if (!title || !type || !value || !category) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parsedCSV.on('end', resolve));

    const existentsCategories = await categoriesRepository.find({
      where: { title: In(categories) },
    });

    const existentsCategoriesTitle = existentsCategories.map(
      (category: Category) => category.title,
    );

    const addCategoriesTitle = categories
      .filter(
        (category: string) => !existentsCategoriesTitle.includes(category),
      )
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoriesTitle.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);
    const finalCategories = [...newCategories, ...existentsCategories];

    const createdTrasactions = transactionRepository.create(
      transactions.map(transaction => ({
        ...transaction,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTrasactions);

    await promises.unlink(csvFilePath);

    return createdTrasactions;
  }
}

export default ImportTransactionsService;
