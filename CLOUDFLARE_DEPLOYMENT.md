# ChinaAR Cloudflare 展示部署说明

## 线上结构

- GitHub private repo: `Yiseut/Registration`
- Cloudflare Pages project: `chinaar`
- 发布目录: `docs`
- 正式演示域名: `chinaar.aestratmc.com`
- 访问控制: Cloudflare One / Access application `globalar`
- 访问策略: `datashow`，只允许 `giselle.ding@gmail.com`

## 首次部署

```powershell
npx wrangler pages project create chinaar --production-branch main
npx wrangler pages deploy docs --project-name chinaar --branch main --commit-dirty=true
```

然后在 Cloudflare 控制台绑定正式域名：

```text
Workers & Pages → chinaar → Custom domains → Add custom domain
chinaar.aestratmc.com
```

Access application 里需要包含：

```text
globalar.aestratmc.com
chinaar.aestratmc.com
```

Policy:

```text
Allow → Include → Emails → giselle.ding@gmail.com
```

## 日常更新

更新数据或页面后，双击：

```text
Deploy-ChinaAR-Cloudflare.bat
```

或运行：

```powershell
npx wrangler pages deploy docs --project-name chinaar --branch main --commit-dirty=true
```

## 检查

- 正式域名应先进入 Cloudflare Access 登录页。
- `chinaar.pages.dev` 或类似 Pages 临时域名也应加入 Access 或禁用/重定向，避免绕过正式域名。
