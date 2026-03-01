# build
use the commands
`docker build . -t weblatex-compilation`
and, for arm,
`docker run --privileged --rm tonistiigi/binfmt --install all` then `docker buildx build --platform linux/arm64 . -t weblatex-compilation`