export type SyncActionType =
  | 'CREATE_ITEM'
  | 'UPDATE_ITEM'
  | 'DELETE_ITEM'
  | 'CREATE_PARTY'
  | 'UPDATE_PARTY'
  | 'DELETE_PARTY'
  | 'CREATE_TRANSACTION'
  | 'UPDATE_TRANSACTION'
  | 'UPDATE_SETTINGS';

export interface SyncOperation {
  id: string;
  action: SyncActionType;
  data: any;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'DONE';
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}
