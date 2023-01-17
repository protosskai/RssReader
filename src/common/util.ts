import {router} from 'src/router'

export const switchPage = (name: string, params?: any) => {
  router!.push({
    name,
    params,
  });
}
