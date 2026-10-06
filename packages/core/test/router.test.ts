import { describe, it, expect } from 'vitest';
import { RadixRouter, splitPath } from '../src/router.js';

describe('RadixRouter', () => {
  it('correctly splits paths', () => {
    expect(splitPath('/')).toEqual([]);
    expect(splitPath('/api/users')).toEqual(['api', 'users']);
    expect(splitPath('//api///users//')).toEqual(['api', 'users']);
    expect(splitPath('/users/:id')).toEqual(['users', ':id']);
  });

  it('matches exact static paths', () => {
    const router = new RadixRouter<string>();
    router.insert('GET', '/', 'root');
    router.insert('GET', '/api/users', 'get-users');
    router.insert('POST', '/api/users', 'post-users');

    const matchRoot = router.match('GET', '/');
    expect(matchRoot).not.toBeNull();
    expect(matchRoot?.handler).toBe('root');
    expect(matchRoot?.params).toEqual({});

    const matchUsers = router.match('GET', '/api/users');
    expect(matchUsers).not.toBeNull();
    expect(matchUsers?.handler).toBe('get-users');

    const matchPost = router.match('POST', '/api/users');
    expect(matchPost).not.toBeNull();
    expect(matchPost?.handler).toBe('post-users');

    const matchUnknown = router.match('DELETE', '/api/users');
    expect(matchUnknown).toBeNull();
  });

  it('matches dynamic parameters', () => {
    const router = new RadixRouter<string>();
    router.insert('GET', '/users/:id', 'get-user');
    router.insert('GET', '/users/:userId/posts/:postId', 'get-user-post');

    const match1 = router.match('GET', '/users/42');
    expect(match1).not.toBeNull();
    expect(match1?.handler).toBe('get-user');
    expect(match1?.params).toEqual({ id: '42' });

    const match2 = router.match('GET', '/users/100/posts/200');
    expect(match2).not.toBeNull();
    expect(match2?.handler).toBe('get-user-post');
    expect(match2?.params).toEqual({ userId: '100', postId: '200' });
  });

  it('prioritizes exact matches over dynamic parameters', () => {
    const router = new RadixRouter<string>();
    router.insert('GET', '/users/me', 'get-me');
    router.insert('GET', '/users/:id', 'get-id');

    const matchMe = router.match('GET', '/users/me');
    expect(matchMe?.handler).toBe('get-me');
    expect(matchMe?.params).toEqual({});

    const matchOther = router.match('GET', '/users/someone');
    expect(matchOther?.handler).toBe('get-id');
    expect(matchOther?.params).toEqual({ id: 'someone' });
  });

  it('matches wildcard routes', () => {
    const router = new RadixRouter<string>();
    router.insert('GET', '/static/*', 'static-files');
    router.insert('GET', '/assets/*filepath', 'asset-files');

    const matchStatic = router.match('GET', '/static/css/style.css');
    expect(matchStatic?.handler).toBe('static-files');
    expect(matchStatic?.params).toEqual({ wildcard: 'css/style.css' });

    const matchAsset = router.match('GET', '/assets/images/logo.png');
    expect(matchAsset?.handler).toBe('asset-files');
    expect(matchAsset?.params).toEqual({ filepath: 'images/logo.png' });
  });

  it('supports ALL method matching', () => {
    const router = new RadixRouter<string>();
    router.insert('ALL', '/health', 'health-check');

    expect(router.match('GET', '/health')?.handler).toBe('health-check');
    expect(router.match('POST', '/health')?.handler).toBe('health-check');
    expect(router.match('PUT', '/health')?.handler).toBe('health-check');
  });

  it('handles complex nested overlapping routes and wildcards', () => {
    const router = new RadixRouter<string>();
    router.insert('GET', '/api/v1/projects/:projectId/teams/:teamId/members', 'team-members');
    router.insert('GET', '/api/v1/projects/:projectId/teams/:teamId/*', 'team-wildcard');
    router.insert('GET', '/api/v1/projects/:projectId/settings', 'project-settings');

    const match1 = router.match('GET', '/api/v1/projects/alpha/teams/core/members');
    expect(match1?.handler).toBe('team-members');
    expect(match1?.params).toEqual({ projectId: 'alpha', teamId: 'core' });

    const match2 = router.match('GET', '/api/v1/projects/alpha/teams/core/documents/report.pdf');
    expect(match2?.handler).toBe('team-wildcard');
    expect(match2?.params).toEqual({ projectId: 'alpha', teamId: 'core', wildcard: 'documents/report.pdf' });

    const match3 = router.match('GET', '/api/v1/projects/beta/settings');
    expect(match3?.handler).toBe('project-settings');
    expect(match3?.params).toEqual({ projectId: 'beta' });
  });
});
