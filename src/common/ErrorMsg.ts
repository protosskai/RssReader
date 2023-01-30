export interface ErrorMsg {
  success: boolean,
  msg: string
}

export interface ErrorData<T> {
  success: boolean,
  msg: string,
  data: T
}
