import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, Category, TransactionType } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Transactions
export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
  const path = 'transactions';
  try {
    return await addDoc(collection(db, path), {
      ...transaction,
      date: Timestamp.fromDate(new Date(transaction.date)),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const subscribeTransactions = (userId: string, callback: (transactions: Transaction[]) => void) => {
  const path = 'transactions';
  const q = query(
    collection(db, path),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transaction[];
    callback(transactions);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

// Categories
export const subscribeCategories = (userId: string, callback: (categories: Category[]) => void) => {
  const path = 'categories';
  const q = query(
    collection(db, path),
    where('userId', 'in', [userId, null])
  );

  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
    callback(categories);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const addCategory = async (category: Omit<Category, 'id'>) => {
  const path = 'categories';
  try {
    return await addDoc(collection(db, path), category);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteCategory = async (categoryId: string) => {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
