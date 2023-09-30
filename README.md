<div align="center">
  <img src="https://github.com/omsimos/umamin/assets/69457996/111a898f-2735-4664-bcd0-385f273ac51f" width="700" />
</div>

<div align="center">
  <a href="https://play.google.com/store/apps/details?id=link.umamin.app">
    <img src="https://user-images.githubusercontent.com/69457996/225260328-aa63b9a8-27fa-49c1-a056-1e4102be475a.png" width="200" />
  </a>
</div>

## About

A collaboration between [Tigris](https://www.facebook.com/cet.tigris) 🤝 [Umamin](https://umamin.link)

--

[Umamin](https://umamin.link) is an open-source platform for sending and receiving anonymous confessions! Each user can create a unique link to which others could send anonymous messages! [Start receiving confessions and messages &rarr;](https://umamin.link)

## Contributing

If you like this project, please consider giving it a star! Want to contribute? Make sure to review our [code of conduct](https://github.com/joshxfi/umamin/blob/main/CODE_OF_CONDUCT.md).

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/L3L682N4R)

### Contributor List

<a href="https://github.com/joshxfi/umamin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=joshxfi/umamin" />
</a>

### Contributing Guide

1. Fork this [repository](https://github.com/joshxfi/umamin) and clone your fork.
2. Create a new branch for your changes:

```sh
$ cd your_cloned_fork
$ git checkout dev
$ git checkout -b my-new-branch
```

3. Create a `.env` in `apps/web` file with this content:

> Adjust the DATABASE_URL to your local MySQL database. [Guide &rarr;](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases/connect-your-database-typescript-mysql)

```sh
DATABASE_URL="mysql://johndoe:randompassword@localhost:3306/mydb"
NEXT_PUBLIC_GQL_ENDPOINT="http://localhost:3000/api/graphql"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="mysupersecretkey"
```

4. Create a `.env` in `packages/db` file with this content:

```sh
DATABASE_URL="mysql://johndoe:randompassword@localhost:3306/mydb"
```

5. _(optional)_ MySQL image with docker:

```sh
yarn docker:up # start up a MySQL image
yarn docker:down # stop MySQL image
```

6. Sync database schema:

```sh
yarn workspace @umamin/db prisma db push
```

> Or run a migration. [Guide &rarr;](https://www.prisma.io/docs/concepts/components/prisma-migrate)

7. To run locally:

```sh
# Only use yarn as your package manager
$ yarn
$ yarn dev
```

8. Commit your changes and push your branch:

```sh
$ git add .
$ git commit -m "chore: some changes"
$ git push origin HEAD
```

9. Submit a pull request on the `dev` branch. (resolve conflicts if present)

## License

Licensed under the [GPL-3.0 license](https://github.com/joshxfi/umamin/blob/main/LICENSE).

---

*Google Play and the Google Play logo are trademarks of Google LLC.*

