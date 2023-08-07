# An Caotharnach

openai.com + abair.ie cabaireoir

## Fograí

Bhain mé úsaid as an api neamh-poiblaí atá taobh thiar abair.ie. Seans maith go mbrisdeadh sé amach anseo.

Tá an OpenAi api an-costasach! Dá bhforcfhá an togra seo, bí cúramach go gcúirfeá limistéar ar an méid á íoc!

## Usáid

Gabh anseo https://platform.openai.com/account/api-keys agus signiú suas.

Caithfidh leagan éicínt Ruby suiteáilithe agat, muna bhfuil tá treoireacha [anseo](https://www.ruby-lang.org/en/documentation/installation/).

Dá mbeadh tathaí agat le Docker, bheadh sé sin níos fusta, sílim: https://hub.docker.com/_/ruby/


```shell
# clón an togra
git clone git@github.com:seocahill/caotharnach.git

# athraigh eolaire
cd caotharnach

# cuir do fáisnéis isteach sa blaosc
export OPENAI_KEY="<do-eochair-openai>"
export OPENAI_ORG="<do-org-id-openai>"

# bhfuil ruby agat?
ruby -v

# suiteáil na spleáchais
bundle install

# toisigh an friothálaí
rackup
```

Cuir localhost:9292 isteach sa brabhsálaí agus beidh an caotharnach ann!

## Buíochas

An foireann i gColáise Bleácliath atá ag obair ar [abair.ie](https://abair.ie). Sár jaib deanta agaibh!