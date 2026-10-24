# An Caotharnach

openai.com + abair.ie cabaireoir

## Fograí

Úsáideann an tionscadal seo API oifigiúil ABAIR (https://api.abair.ie/v4/docs) le haghaidh aitheanta cainte agus sintéise. Gheobhaidh tú eochair API ar do chuntas ABAIR. Tá sé riachtanach aitheantas a thabhairt do ABAIR agus a lógó a chur san áireamh.

Tá an OpenAi api an-costasach! Dá bhforcfhá an togra seo, bí cúramach go gcúirfeá limistéar ar an méid á íoc!

## Usáid

Gabh anseo https://platform.openai.com/account/api-keys agus signiú suas.

Caithfidh leagan éicínt Ruby suiteáilithe agat, muna bhfuil tá treoireacha [anseo](https://www.ruby-lang.org/en/documentation/installation/).

Dá mbeadh tathí agat le Docker, bheadh sé sin níos fusa, sílim: https://hub.docker.com/_/ruby/


```shell
# clón an togra
git clone git@github.com:seocahill/caotharnach.git

# athraigh eolaire
cd caotharnach

# cuir do fáisnéis isteach sa blaosc
export OPENAI_KEY="<do-eochair-openai>"
export OPENAI_ORG="<do-org-id-openai>"
export ABAIR_API_KEY="<do-eochair-abair>"

# roghnach: guth réamhshocraithe (féach /api/voices don liosta)
export ABAIR_DEFAULT_VOICE="ga_UL_anb_piper"

# bhfuil ruby agat?
ruby -v

# suiteáil na spleáchais
bundle install

# toisigh an friothálaí
rackup
```

Cuir localhost:9292 isteach sa brabhsálaí agus beidh an caotharnach ann!

## Tástálacha

```shell
bundle exec ruby -Itest -e 'Dir["test/*_test.rb"].each { |f| require "./#{f}" }'
```

Ar Fly: `fly secrets set ABAIR_API_KEY=...`

## Buíochas

An foireann i gColáise Bleácliath atá ag obair ar [abair.ie](https://abair.ie). Sár jaib deanta agaibh!