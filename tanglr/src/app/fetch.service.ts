import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Rx';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';
import { Http, Response, RequestOptions, Headers } from '@angular/http';
import { apiIp } from '../api.config';

@Injectable()
export class FetchService {
    constructor(private http: Http) { }

    fetchBundles(): Observable<any> {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const options = new RequestOptions({ headers });

        return this.http.get(`${apiIp}/bundles`, options)
        .map(res => res.json())
        .catch(err => {
            return Observable.throw(err);
        });
    }

  addBundle(bundleHash: string): Observable<Response> {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const options = new RequestOptions({ headers });

    return this.http.post(`${apiIp}/bundles/${bundleHash}`, options)
      .map((res: Response) => res.json())
      .catch((err: Response) => Observable.throw((<any>err)._body));
  }
}
