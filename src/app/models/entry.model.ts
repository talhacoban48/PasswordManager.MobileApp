export interface Entry {
  appname: string;
  username: string | null;
  email: string | null;
  password: string;
  url: string | null;
  recordStatus: boolean;
  createdDate: string | null;
  updatedDate: string | null;
}

export interface EntryListItem {
  appname: string;
  recordStatus: number;
}
