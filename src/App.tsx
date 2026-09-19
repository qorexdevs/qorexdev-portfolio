import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  Plus,
  Code,
  Check,
} from '@phosphor-icons/react';
import { projects, contacts, type Project } from './data/projects';
import './portfolio.css';

const FlowDesk = lazy(() => import('./demos/FlowDesk'));
const Orderly = lazy(() => import('./demos/Orderly'));
const PriceWatch = lazy(() => import('./demos/PriceWatch'));

function Wordmark() {
  return (
    <a href="/" className="wordmark" aria-label="qorexdev - главная">
      qorexdev
      <span className="brand-square" aria-hidden="true" />
    </a>
  );
}

function Header() {
  return (
    <header className="site-header wrap">
      <Wordmark />
      <nav aria-label="Основная навигация">
        <a href="/#work">Проекты</a>
        <a href="/#approach">Подход</a>
        <a className="nav-contact" href="/#contact">
          Обсудить задачу <ArrowUpRight size={17} />
        </a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer wrap">
      <Wordmark />
      <p>Веб-сервисы. Telegram. Автоматизация.</p>
      <a href="#top">
        Наверх <ArrowUpRight size={16} />
      </a>
    </footer>
  );
}

function Contact() {
  return (
    <section id="contact" className="contact wrap">
      <div className="contact-heading">
        <p className="section-label">Есть задача?</p>
        <h2>
          Давайте разберемся
          <br />и сделаем.
        </h2>
        <p className="contact-note">
          Расскажите, что сейчас работает неудобно.
          <br />
          Обсудим задачу, ограничения и первый шаг.
        </p>
      </div>
      <div className="contact-links">
        {contacts.map((c) => (
          <a key={c.name} href={c.href} aria-label={c.name} target="_blank" rel="noreferrer">
            <div>
              <span>{c.label}</span>
              <strong>{c.name}</strong>
            </div>
            <ArrowUpRight size={30} weight="light" />
          </a>
        ))}
      </div>
    </section>
  );
}

function ProjectPreview({ project, featured = false }: { project: Project; featured?: boolean }) {
  return (
    <article className={`project-item ${featured ? 'featured-project' : ''}`}>
      <a
        href={`/work/${project.slug}`}
        className={`project-picture ${project.tone}`}
        aria-label={`Кейс ${project.name}`}
      >
        <div className="project-picture-title">
          <span>{project.name}</span>
          <ArrowUpRight size={28} weight="light" />
        </div>
        <img
          src={project.image}
          alt={`${project.name}: работающий интерфейс демоверсии`}
          loading="lazy"
          width="1440"
          height="1000"
        />
      </a>
      <div className="project-caption">
        <div>
          <p>{project.type}</p>
          <h3>{project.caption}</h3>
        </div>
        <a href={`/demo/${project.slug}`} aria-label={`Демо ${project.name}`}>
          Попробовать <ArrowUpRight size={18} />
        </a>
      </div>
    </article>
  );
}

function Home() {
  useEffect(() => {
    document.title = 'qorexdev - веб-сервисы и автоматизация';
  }, []);
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-kicker">
            <span>Независимый разработчик</span>
            <span>От задачи до работающего продукта</span>
          </div>
          <h1 id="hero-title">
            Сервисы,
            <br />
            которые работают<span className="orange">.</span>
          </h1>
          <div className="hero-bottom">
            <p>
              Разрабатываю веб-сервисы, Telegram-приложения
              <br className="desktop-break" /> и автоматизацию для бизнеса.
            </p>
            <a className="hero-link" href="#work">
              Смотреть проекты{' '}
              <span>
                <ArrowDown size={24} />
              </span>
            </a>
          </div>
          <div className="hero-showcase" aria-label="Превью демонстрационных проектов">
            <a href="/demo/flowdesk" className="showcase-desktop" aria-label="Попробовать FlowDesk">
              <div className="window-bar">
                <span>FlowDesk</span>
                <span>Рабочее пространство</span>
                <ArrowUpRight size={15} />
              </div>
              <img
                src="/previews/flowdesk.png"
                alt="Kanban-доска заявок FlowDesk"
                width="1440"
                height="1000"
                fetchPriority="high"
              />
            </a>
            <a
              href="/demo/pricewatch"
              className="showcase-chart"
              aria-label="Попробовать PriceWatch"
            >
              <img
                src="/previews/pricewatch.png"
                alt="График мониторинга цен PriceWatch"
                width="1440"
                height="1000"
              />
            </a>
            <a href="/demo/orderly" className="showcase-phone" aria-label="Попробовать Orderly">
              <img
                src="/previews/orderly-mobile.png"
                alt="Мобильный каталог кофе Orderly"
                width="390"
                height="844"
              />
            </a>
            <div className="showcase-note">
              <Code size={20} />
              <span>
                Можно открыть.
                <br />
                Можно попробовать.
              </span>
            </div>
          </div>
        </section>

        <section id="work" className="work-section wrap">
          <div className="work-heading">
            <h2>
              Работа в деталях<span className="orange">/</span>
            </h2>
            <p>
              Три демонстрационных проекта. Настоящие интерфейсы,
              <br className="desktop-break" /> сохранение данных и законченные сценарии.
            </p>
          </div>
          <div className="project-grid">
            {projects.map((p, i) => (
              <ProjectPreview key={p.slug} project={p} featured={i === 0} />
            ))}
          </div>
          <p className="honesty-note">
            <Check size={17} />
            Все проекты созданы для демонстрации возможностей. Данные синтетические, клиентских
            материалов нет.
          </p>
        </section>

        <section className="capabilities wrap" aria-labelledby="capabilities-title">
          <div className="capabilities-intro">
            <p className="section-label">Чем могу помочь</p>
            <h2 id="capabilities-title">
              Меньше рутины.
              <br />
              Больше порядка.
            </h2>
            <p>
              Начинаю с того, что нужно людям.
              <br />
              Подбираю технологии под задачу.
            </p>
          </div>
          <div className="capability-list">
            <article>
              <span className="capability-symbol" aria-hidden="true">
                <Plus size={27} weight="light" />
              </span>
              <div>
                <h3>Собрать работу в одном месте</h3>
                <p>
                  CRM, личные кабинеты и внутренние сервисы. Заявки, роли, история действий и
                  понятные рабочие процессы.
                </p>
                <a href="/work/flowdesk">
                  Как это устроено в FlowDesk <ArrowRight size={17} />
                </a>
              </div>
            </article>
            <article>
              <span className="capability-symbol" aria-hidden="true">
                <Plus size={27} weight="light" />
              </span>
              <div>
                <h3>Сократить путь до заказа</h3>
                <p>
                  Telegram Mini Apps и боты. Каталоги, запись, корзина и управление заказами в
                  привычной среде.
                </p>
                <a href="/work/orderly">
                  Посмотреть сценарий Orderly <ArrowRight size={17} />
                </a>
              </div>
            </article>
            <article>
              <span className="capability-symbol" aria-hidden="true">
                <Plus size={27} weight="light" />
              </span>
              <div>
                <h3>Передать повторяющееся коду</h3>
                <p>
                  Мониторинг, фоновые задачи и интеграции. Проверять изменения, собирать данные и
                  вовремя уведомлять.
                </p>
                <a href="/work/pricewatch">
                  Пример автоматизации PriceWatch <ArrowRight size={17} />
                </a>
              </div>
            </article>
          </div>
        </section>

        <section id="approach" className="process wrap">
          <h2>
            Понятный процесс.
            <br />
            Предсказуемый результат.
          </h2>
          <div className="process-grid">
            {[
              [
                'Разобраться',
                'Обсуждаем пользователей, задачу и ограничения. Фиксируем, что должно получиться и как это проверить.',
              ],
              [
                'Собрать основу',
                'Проектирую сценарии и интерфейс. Показываю работающий основной путь до расширения возможностей.',
              ],
              [
                'Довести до работы',
                'Связываю интерфейс с данными, проверяю ошибки, права доступа и мобильную версию.',
              ],
              [
                'Передать',
                'Подготавливаю запуск, настройки и инструкцию. Обсуждаем дальнейшую поддержку и развитие.',
              ],
            ].map(([title, copy]) => (
              <article key={title}>
                <span className="process-tick" />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <Contact />
      </main>
      <Footer />
    </>
  );
}

function CasePage({ project }: { project: Project }) {
  useEffect(() => {
    document.title = `${project.name} - демонстрационный проект / qorexdev`;
  }, [project]);
  const next = projects[(projects.indexOf(project) + 1) % projects.length];
  return (
    <>
      <Header />
      <main id="main" className="case-page">
        <section className="case-hero wrap">
          <a className="back-link" href="/#work">
            <ArrowLeft size={17} /> Все проекты
          </a>
          <div className="case-label">
            <span>Демонстрационный проект</span>
            <span>{project.type}</span>
          </div>
          <h1>
            {project.name}
            <span className="orange">.</span>
          </h1>
          <div className="case-intro">
            <h2>{project.caption}</h2>
            <div>
              <p>{project.summary}</p>
              <a className="solid-link" href={`/demo/${project.slug}`}>
                Открыть {project.name}
                <ArrowUpRight size={21} />
              </a>
            </div>
          </div>
        </section>
        <figure className={`case-screenshot ${project.tone}`}>
          <img
            src={project.image}
            alt={`Скриншот ${project.name} в браузере`}
            width="1440"
            height="1000"
          />
          <figcaption>Снимок работающей демоверсии. Синтетические данные.</figcaption>
        </figure>
        <div className="case-body wrap">
          <aside>
            <p className="section-label">Моя роль</p>
            <p>
              Проектирование сценариев,
              <br />
              дизайн, frontend,
              <br />
              backend и подготовка запуска.
            </p>
            <p className="case-stack">
              React / TypeScript
              <br />
              Node.js / Express
              <br />
              SQLite / Docker
            </p>
          </aside>
          <div className="case-narrative">
            <section>
              <h2>Задача</h2>
              <p>{project.challenge}</p>
            </section>
            <section>
              <h2>Что получилось</h2>
              <p>{project.solution}</p>
              <ul className="feature-list">
                {project.features.map((f) => (
                  <li key={f}>
                    <Check size={18} />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Технические решения</h2>
              {project.decisions.map(([title, copy]) => (
                <article className="technical-decision" key={title}>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </section>
          </div>
        </div>
        <section className="case-mobile-section wrap">
          <div>
            <p className="section-label">Мобильная версия</p>
            <h2>
              Тот же продукт.
              <br />
              Другой ритм.
            </h2>
            <p>
              Основной сценарий доступен с телефона. Навигация, формы и действия адаптированы под
              небольшой экран.
            </p>
          </div>
          <div className={`case-phone-stage ${project.tone}`}>
            <img
              src={project.mobileImage}
              alt={`${project.name} на экране телефона`}
              width="390"
              height="844"
              loading="lazy"
            />
          </div>
        </section>
        <section className="case-limits wrap">
          <div>
            <h2>Границы демоверсии</h2>
            <p>{project.limits}</p>
            <p>
              Изменения изолированы от других посетителей. Данные хранятся до 24 часов; их можно
              сбросить вручную. Не вводите реальные персональные данные.
            </p>
          </div>
          <div className="try-case">
            <h3>Попробуйте основной сценарий</h3>
            <p>{project.journey}</p>
            <a className="solid-link" href={`/demo/${project.slug}`}>
              Открыть {project.name}
              <ArrowUpRight size={20} />
            </a>
          </div>
        </section>
        <a href={`/work/${next.slug}`} className="next-case wrap">
          <span>Следующий проект</span>
          <strong>{next.name}</strong>
          <ArrowUpRight size={55} weight="light" />
        </a>
        <Contact />
      </main>
      <Footer />
    </>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="route-message">
        <h1>Не удалось открыть страницу</h1>
        <p>Обновите страницу. Если ошибка повторится, вернитесь в портфолио.</p>
        <button onClick={() => window.location.reload()}>Попробовать еще раз</button>
        <a href="/">На главную</a>
      </main>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const project = projects.find((p) => path === `/work/${p.slug}`);
  const Demo =
    path === '/demo/flowdesk'
      ? FlowDesk
      : path === '/demo/orderly'
        ? Orderly
        : path === '/demo/pricewatch'
          ? PriceWatch
          : null;
  useEffect(() => {
    if (Demo)
      document.title = `${projects.find((p) => path.endsWith(p.slug))?.name} - интерактивная демоверсия / qorexdev`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = Demo ? 'noindex, nofollow' : 'index, follow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, [Demo, path]);
  return (
    <ErrorBoundary>
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <div id="top" />
      {Demo ? (
        <Suspense
          fallback={
            <main className="route-message" aria-busy="true">
              Загружаем рабочее пространство...
            </main>
          }
        >
          <Demo />
        </Suspense>
      ) : project ? (
        <CasePage project={project} />
      ) : path === '/' ? (
        <Home />
      ) : (
        <>
          <Header />
          <main id="main" className="route-message">
            <p className="orange">404</p>
            <h1>Страница не найдена</h1>
            <p>Кажется, в адресе ошибка. Все проекты есть на главной.</p>
            <a className="solid-link" href="/">
              На главную <ArrowRight size={20} />
            </a>
          </main>
          <Footer />
        </>
      )}
    </ErrorBoundary>
  );
}
